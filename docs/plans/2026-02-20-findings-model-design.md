# Findings Model Upgrade — Design

Date: 2026-02-20
Status: Approved
Prerequisite for: Wave 1 analyzer modules (ast-grep, dependency-cruiser, import-linter)

## Problem

The current audit result model supports one `status` + one optional `message` per check. Analyzer tools (semgrep, ast-grep, dependency-cruiser, etc.) produce multiple findings per invocation — each with a rule ID, location, severity, and message. The engine cannot represent this today.

## Decision Record

- **Result shape:** Multiple findings per check (not one CheckResult per finding)
- **Output:** Human-readable summary by default, `--json` for structured output, `--verbose` for inline findings
- **Finding schema:** Minimal, aligned to SARIF/ESLint/GitHub common denominator
- **Integration approach:** Extend existing CheckResult (Approach A) — additive, no breaking changes

## Finding Type

```typescript
interface Finding {
  ruleId: string;           // e.g. "no-unused-vars", "SEC01"
  message: string;          // human-readable description
  severity: "error" | "warning" | "info";
  file?: string;            // relative to project root
  line?: number;            // 1-based
  column?: number;          // 1-based
  endLine?: number;
  endColumn?: number;
}
```

Field selection rationale:
- `ruleId`, `message`, `severity`, `file`, `line` are universal across SARIF, ESLint, Semgrep, ast-grep, and GitHub annotations
- Flat location fields (not nested) match existing `CheckResult.file` pattern
- Maps trivially to SARIF results, GitHub annotations, and `file:line:col severity message (ruleId)` console format
- Intentionally omits fix suggestions, fingerprints, and metadata bags — add later if needed

## Extended CheckResult

```typescript
interface CheckResult {
  contractId: string;
  contractDescription: string;
  checkName: string;
  status: CheckStatus;       // unchanged
  message?: string;          // unchanged — summary text
  file?: string;             // unchanged
  findings?: Finding[];      // NEW — populated by analyzer checks
}
```

Existing checks (regex, path_exists, yaml_key, etc.) produce no findings. Analyzer modules populate `findings[]`. A check's `status` is derived from findings when present (any error-severity finding -> fail, only warnings -> warn per on_fail policy).

## Module Return Type

```typescript
type ModuleResult =
  | boolean                                    // simple: pass/fail
  | { passed: boolean; findings: Finding[] }   // analyzer: pass/fail + findings
```

The runner handles both. Existing modules return `true`/`false`. New analyzer modules return the richer shape.

## AuditResult Extension

```typescript
interface AuditResult {
  results: CheckResult[];
  passed: number;
  failed: number;
  exempt: number;
  skipped: number;
  warned: number;
  totalFindings?: number;  // NEW — sum across all checks
}
```

## Reporter Output

### Default (human-readable)

One line per contract, unchanged format. When findings exist, message shows count:

```
C-001     FAIL    No secrets in source     — 3 findings
C-TS01    PASS    TypeScript strict mode
```

### Verbose (`--verbose`)

Findings expand underneath their contract:

```
C-001     FAIL    No secrets in source     — 3 findings
  error  src/config.ts:42    AWS access key detected (no-aws-keys)
  error  src/db.ts:17        Database password in plaintext (no-plaintext-secrets)
  warn   .env.example:3      Potential token pattern (suspicious-token)
```

Format: `severity  file:line  message (ruleId)` — the gcc/tsc convention.

### JSON (`--json`)

Full `AuditResult` serialized to stdout. Human output suppressed:

```json
{
  "results": [
    {
      "contractId": "C-001",
      "status": "fail",
      "findings": [
        { "ruleId": "no-aws-keys", "message": "AWS access key detected", "severity": "error", "file": "src/config.ts", "line": 42 }
      ]
    }
  ],
  "passed": 5,
  "failed": 1,
  "totalFindings": 3
}
```

Exit code unchanged: 0 = no failures, 1 = any failure.

## What Does NOT Change

- Contract YAML schema — no new fields needed
- Parser / Zod validation
- Scope resolver
- Exemption lookup
- Trigger filtering
- skip_if logic
- Existing check modules
- Existing integration tests

## Scope

This work covers the engine foundation only:

1. `Finding` type + `CheckResult` extension in `types.ts`
2. `ModuleResult` handling in `runner.ts`
3. `--verbose` flag on audit command
4. `--json` flag on audit command
5. Reporter updates for verbose and JSON modes
6. `totalFindings` in `AuditResult`
7. Tests for all of the above

Analyzer modules (ast-grep, dependency-cruiser, import-linter) ship separately in Wave 1.

## Convention Alignment

The Finding type maps to standard formats:

| Target | Mapping |
|--------|---------|
| SARIF result | `ruleId` -> `ruleId`, `message` -> `message.text`, `severity` -> `level`, location fields -> `region.*` |
| GitHub annotation | `severity` -> `annotation_level` (error->failure, warning->warning, info->notice), `file` -> `path` |
| Console | `file:line:col severity message (ruleId)` |
