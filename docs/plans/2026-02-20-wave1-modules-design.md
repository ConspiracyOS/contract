# Wave 1 Analyzer Modules — Design

Date: 2026-02-20
Status: Approved
Depends on: Findings-model upgrade (shipped)
Issues: #3 (ast-grep), #4 (dependency-cruiser), #5 (import-linter)

## Problem

The engine now supports `Finding[]` on check results, but no check modules produce findings yet. Wave 1 adds three analyzer modules that run external tools and convert their output into structured findings.

## Decision Record

- **Check type schema:** One dedicated YAML key per tool (`ast_grep:`, `dependency_cruiser:`, `import_linter:`)
- **Input:** ast-grep uses rule file path; dependency-cruiser uses config file path; import-linter uses optional config path
- **Module architecture:** Three independent modules, no shared abstraction
- **Missing tools:** Fail loudly by default; users add `skip_if.command_not_available` explicitly
- **Built-in contracts:** None — all project-authored only
- **Testing:** Mock tool output; no real tool execution in CI

## Check Type Schemas

### ast_grep

```yaml
checks:
  - name: no-console-log
    ast_grep:
      rule: .agent/rules/no-console-log.yaml   # path to sg rule file (required)
    on_fail: warn
```

Runs: `sg scan --json --rule <rule-path> <scoped-paths>`

Respects file scoping — scoped paths are passed as positional arguments to `sg scan`.

### dependency_cruiser

```yaml
checks:
  - name: no-circular-deps
    dependency_cruiser:
      config: .dependency-cruiser.cjs           # path to depcruise config (required)
    on_fail: fail
```

Runs: `npx depcruise --output-type json --config <config-path> <scoped-paths>`

Respects file scoping — scoped paths passed as entry points.

### import_linter

```yaml
checks:
  - name: layer-contracts
    import_linter:
      config: .importlinter                     # path to config file (optional)
    on_fail: fail
```

Runs: `lint-imports --config <config-path>`

Always `scope: global` — analyzes the whole Python package per its own config.

## Type Definitions

```typescript
export interface AstGrepCheck {
  ast_grep: { rule: string };
}

export interface DependencyCruiserCheck {
  dependency_cruiser: { config: string };
}

export interface ImportLinterCheck {
  import_linter: { config?: string };
}
```

Added to the `CheckModule` union in `types.ts`.

## Module Implementations

Three files in `src/engine/modules/`:

### ast-grep.ts (~60 lines)

- Spawns `sg scan --json --rule <rule> <paths>` via `Bun.spawnSync`
- Parses JSON array output
- Maps each match to Finding:
  - `ruleId` from `match.ruleId`
  - `message` from `match.message`
  - `severity`: hint→info, else pass through (error/warning/info)
  - `file` from `match.file`
  - `line`: `match.range.start.line + 1` (ast-grep uses 0-based)
  - `column`: `match.range.start.column + 1`
  - `endLine`: `match.range.end.line + 1`
  - `endColumn`: `match.range.end.column + 1`
- Returns `{ pass: findings.length === 0, findings }`
- Tool-not-found: `{ pass: false, reason: "sg (ast-grep) not found in PATH" }`

### dependency-cruiser.ts (~60 lines)

- Spawns `npx depcruise --output-type json --config <config> <paths>` via `Bun.spawnSync`
- Parses JSON, reads `summary.violations` array
- Filters out `severity: "ignore"` violations
- Maps each violation to Finding:
  - `ruleId` from `violation.rule.name`
  - `message`: `"from → to"` (with cycle path if circular)
  - `severity`: warn→warning, else pass through
  - `file` from `violation.from`
  - No line/column (dependency-cruiser reports at file level only)
- Returns `{ pass: findings.length === 0, findings }`

### import-linter.ts (~80 lines)

- Spawns `lint-imports --config <config>` via `Bun.spawnSync`
- Parses text stdout with regex state machine:
  - Finds "Broken contracts" section
  - Extracts contract name headers
  - Extracts violation lines matching `/^\s+(\S+):(\d+):\s+(.+)$/`
- Maps violations to Finding:
  - `ruleId`: contract name
  - `message`: the import statement text
  - `severity`: always "error" (broken contract)
  - `file`: module path converted from dots to slashes + `.py`
  - `line`: parsed from violation line
- Returns `{ pass: findings.length === 0, findings }`
- No JSON mode available — text parsing is required

## Runner Wiring

Three new dispatch cases in `runSingleCheck()` in `runner.ts`:

```typescript
if (c["ast_grep"]) {
  const m = c["ast_grep"] as { rule: string };
  return await runAstGrepCheck(m, file, projectRoot);
}
if (c["dependency_cruiser"]) {
  const m = c["dependency_cruiser"] as { config: string };
  return await runDependencyCruiserCheck(m, file, projectRoot);
}
if (c["import_linter"]) {
  const m = c["import_linter"] as { config?: string };
  return await runImportLinterCheck(m, projectRoot);
}
```

## Scope Interaction

- `ast_grep`: File-scoped. Scoped files are passed to `sg scan` as positional arguments.
- `dependency_cruiser`: File-scoped. Scoped paths are entry points for `depcruise`.
- `import_linter`: Global scope only. The tool analyzes per its own config, not per-file.

For file-scoped modules, the runner calls the module once per scoped file. The module receives the file path and uses it as input. For `import_linter`, contracts should use `scope: global`.

## Tool Output Formats

### ast-grep JSON

```json
[
  {
    "ruleId": "no-console-log",
    "message": "Avoid console.log",
    "severity": "warning",
    "file": "src/main.ts",
    "range": {
      "start": { "line": 41, "column": 4 },
      "end": { "line": 41, "column": 20 }
    }
  }
]
```

### dependency-cruiser JSON

```json
{
  "summary": {
    "violations": [
      {
        "from": "src/foo.ts",
        "to": "src/bar.ts",
        "rule": { "name": "no-circular", "severity": "error" },
        "cycle": ["src/foo.ts", "src/bar.ts", "src/foo.ts"]
      }
    ]
  }
}
```

### import-linter text

```
Broken contracts
----------------
my_forbidden_contract
---------------------
mypackage.foo is not allowed to import mypackage.bar:
  mypackage.foo:8: from mypackage import bar
```

## Testing Strategy

### Unit tests (mock tool output)

Per module (`tests/unit/modules/ast-grep.test.ts`, etc.):
- Zero-match case → pass, no findings
- Multi-match case → fail with correctly mapped findings
- Tool-not-found → fail with reason message
- Malformed output → fail with reason message

Tests mock `Bun.spawnSync` to return canned JSON/text output. No real tool execution.

### Integration tests

Added to `tests/integration/audit.test.ts`:
- Parse a real YAML contract with each new check type
- Mock the tool execution
- Verify findings flow through the full pipeline to AuditResult

## What Does NOT Change

- Existing check modules (regex, path_exists, yaml_key, etc.)
- Contract YAML schema for existing check types
- Reporter (already supports findings from the findings-model upgrade)
- Parser Zod validation (needs extending for new check types)
- No built-in contracts added

## Scope

This work covers three modules:

1. Types + interfaces for `ast_grep`, `dependency_cruiser`, `import_linter`
2. Module implementations (three files)
3. Runner dispatch wiring
4. Parser/Zod schema updates for new check types
5. Unit tests per module
6. Integration tests
