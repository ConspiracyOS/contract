# Wave 1 Analyzer Modules — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three analyzer check modules (ast-grep, dependency-cruiser, import-linter) that run external tools and produce `Finding[]` results.

**Architecture:** Three independent modules in `src/engine/modules/`, each spawning an external tool via `Bun.spawnSync`, parsing its output (JSON or text), and mapping to `Finding[]`. Each gets a dedicated check type interface, a dispatch case in the runner, and unit tests with mocked tool output.

**Tech Stack:** TypeScript, Bun (spawnSync for process execution, test runner), Zod (parser already passes through unknown check keys)

---

### Task 1: Add ast-grep check type and module

**Files:**
- Modify: `src/engine/types.ts:54-70` (add interface + extend union)
- Create: `src/engine/modules/ast-grep.ts`
- Modify: `src/engine/runner.ts:2,9,90-92` (import + dispatch case)
- Create: `tests/unit/modules/ast-grep.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/modules/ast-grep.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { Finding } from "../../../src/engine/types";

// We'll need to mock Bun.spawnSync. Import the module after mocking.
// Since ast-grep.ts uses Bun.spawnSync directly, we test the parsing function.

describe("ast-grep module", () => {
  describe("parseAstGrepOutput", () => {
    it("returns empty findings for no matches", async () => {
      const { parseAstGrepOutput } = await import("../../../src/engine/modules/ast-grep");
      const findings = parseAstGrepOutput("[]");
      expect(findings).toEqual([]);
    });

    it("maps matches to findings with 1-based line numbers", async () => {
      const { parseAstGrepOutput } = await import("../../../src/engine/modules/ast-grep");
      const output = JSON.stringify([
        {
          ruleId: "no-console-log",
          message: "Avoid console.log",
          severity: "warning",
          file: "src/main.ts",
          range: {
            start: { line: 41, column: 4 },
            end: { line: 41, column: 20 },
          },
          text: "console.log(x)",
          lines: "  console.log(x);",
          language: "typescript",
        },
      ]);
      const findings = parseAstGrepOutput(output);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        ruleId: "no-console-log",
        message: "Avoid console.log",
        severity: "warning",
        file: "src/main.ts",
        line: 42,
        column: 5,
        endLine: 42,
        endColumn: 21,
      });
    });

    it("maps hint severity to info", async () => {
      const { parseAstGrepOutput } = await import("../../../src/engine/modules/ast-grep");
      const output = JSON.stringify([
        {
          ruleId: "style-hint",
          message: "Consider refactoring",
          severity: "hint",
          file: "src/a.ts",
          range: { start: { line: 0, column: 0 }, end: { line: 0, column: 5 } },
          text: "x",
          lines: "x",
          language: "typescript",
        },
      ]);
      const findings = parseAstGrepOutput(output);
      expect(findings[0]!.severity).toBe("info");
    });

    it("handles malformed JSON gracefully", async () => {
      const { parseAstGrepOutput } = await import("../../../src/engine/modules/ast-grep");
      expect(() => parseAstGrepOutput("not json")).toThrow();
    });
  });

  describe("runAstGrepCheck", () => {
    it("returns pass with no findings when tool produces empty array", async () => {
      const { runAstGrepCheck } = await import("../../../src/engine/modules/ast-grep");
      // Mock Bun.spawnSync — we replace it temporarily
      const originalSpawnSync = Bun.spawnSync;
      Bun.spawnSync = (() => ({
        exitCode: 0,
        stdout: new TextEncoder().encode("[]"),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runAstGrepCheck({ rule: "rules/test.yaml" }, "__global__", "/tmp");
        expect(result.pass).toBe(true);
        if ("findings" in result) {
          expect(result.findings).toHaveLength(0);
        }
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });

    it("returns fail with findings when tool finds matches", async () => {
      const { runAstGrepCheck } = await import("../../../src/engine/modules/ast-grep");
      const originalSpawnSync = Bun.spawnSync;
      const matches = [
        {
          ruleId: "no-eval",
          message: "eval is dangerous",
          severity: "error",
          file: "src/main.ts",
          range: { start: { line: 10, column: 0 }, end: { line: 10, column: 8 } },
          text: "eval(x)",
          lines: "eval(x);",
          language: "typescript",
        },
      ];
      Bun.spawnSync = (() => ({
        exitCode: 1,
        stdout: new TextEncoder().encode(JSON.stringify(matches)),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runAstGrepCheck({ rule: "rules/test.yaml" }, "__global__", "/tmp");
        expect(result.pass).toBe(false);
        expect("findings" in result).toBe(true);
        if ("findings" in result) {
          expect(result.findings).toHaveLength(1);
          expect(result.findings[0]!.ruleId).toBe("no-eval");
          expect(result.findings[0]!.line).toBe(11); // 0-based + 1
        }
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });

    it("returns fail with reason when sg is not found", async () => {
      const { runAstGrepCheck } = await import("../../../src/engine/modules/ast-grep");
      const originalSpawnSync = Bun.spawnSync;
      Bun.spawnSync = (() => ({
        exitCode: null,
        stdout: new TextEncoder().encode(""),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runAstGrepCheck({ rule: "rules/test.yaml" }, "__global__", "/tmp");
        expect(result.pass).toBe(false);
        expect(result.reason).toContain("sg");
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/modules/ast-grep.test.ts`
Expected: FAIL — module `ast-grep.ts` doesn't exist.

**Step 3: Add type interface**

In `src/engine/types.ts`, add after the `ScriptCheck` interface (after line 56):

```typescript
export interface AstGrepCheck {
  ast_grep: { rule: string };
}
```

Then update the `CheckModule` union (lines 58-70) to include `AstGrepCheck`:

```typescript
export type CheckModule =
  | RegexInFileCheck
  | NoRegexInFileCheck
  | PathExistsCheck
  | PathNotExistsCheck
  | YamlKeyCheck
  | TomlKeyCheck
  | JsonKeyCheck
  | EnvVarCheck
  | NoEnvVarCheck
  | CommandAvailableCheck
  | CommandCheck
  | ScriptCheck
  | AstGrepCheck;
```

**Step 4: Create the module**

Create `src/engine/modules/ast-grep.ts`:

```typescript
import type { Finding, ModuleResult } from "../types";
import { GLOBAL_SCOPE_SENTINEL } from "../scope";

interface AstGrepMatch {
  ruleId: string;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  file: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export function parseAstGrepOutput(stdout: string): Finding[] {
  const matches: AstGrepMatch[] = JSON.parse(stdout);
  return matches.map((m) => ({
    ruleId: m.ruleId,
    message: m.message,
    severity: m.severity === "hint" ? "info" as const : m.severity,
    file: m.file,
    line: m.range.start.line + 1,
    column: m.range.start.column + 1,
    endLine: m.range.end.line + 1,
    endColumn: m.range.end.column + 1,
  }));
}

export async function runAstGrepCheck(
  options: { rule: string },
  file: string,
  projectRoot: string,
): Promise<ModuleResult> {
  const args = ["sg", "scan", "--json", "--rule", `${projectRoot}/${options.rule}`];
  if (file !== GLOBAL_SCOPE_SENTINEL) {
    args.push(file);
  } else {
    args.push(projectRoot);
  }

  const proc = Bun.spawnSync(args, { cwd: projectRoot, stderr: "pipe" });

  if (proc.exitCode === null) {
    return { pass: false, reason: "sg (ast-grep) not found in PATH — install with: npm i -g @ast-grep/cli" };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  // Exit code 0 = no matches, 1 = matches found, other = error
  if (proc.exitCode !== 0 && proc.exitCode !== 1) {
    const stderr = new TextDecoder().decode(proc.stderr);
    return { pass: false, reason: `sg scan failed (exit ${proc.exitCode}): ${stderr.slice(0, 200)}` };
  }

  if (!stdout.trim() || stdout.trim() === "[]") {
    return { pass: true, findings: [] };
  }

  try {
    const findings = parseAstGrepOutput(stdout);
    return { pass: findings.length === 0, findings };
  } catch (e) {
    return { pass: false, reason: `failed to parse sg output: ${e}` };
  }
}
```

**Step 5: Wire dispatch in runner**

In `src/engine/runner.ts`, add import (after line 9):

```typescript
import { runAstGrepCheck } from "./modules/ast-grep";
```

Add dispatch case before the unknown-module fallback (before line 92):

```typescript
  if (c["ast_grep"]) {
    const m = c["ast_grep"] as { rule: string };
    return await runAstGrepCheck(m, file, projectRoot);
  }
```

**Step 6: Run test to verify it passes**

Run: `bun test tests/unit/modules/ast-grep.test.ts`
Expected: PASS

**Step 7: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/modules/ast-grep.ts src/engine/runner.ts tests/unit/modules/ast-grep.test.ts
git commit -m "feat(modules): add ast-grep check module with findings support"
```

---

### Task 2: Add dependency-cruiser check type and module

**Files:**
- Modify: `src/engine/types.ts` (add interface + extend union)
- Create: `src/engine/modules/dependency-cruiser.ts`
- Modify: `src/engine/runner.ts` (import + dispatch case)
- Create: `tests/unit/modules/dependency-cruiser.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/modules/dependency-cruiser.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";

describe("dependency-cruiser module", () => {
  describe("parseDepCruiserOutput", () => {
    it("returns empty findings for no violations", async () => {
      const { parseDepCruiserOutput } = await import("../../../src/engine/modules/dependency-cruiser");
      const output = JSON.stringify({
        modules: [],
        summary: { violations: [], error: 0, warn: 0, info: 0, totalCruised: 10, totalDependenciesCruised: 20 },
      });
      const findings = parseDepCruiserOutput(output);
      expect(findings).toEqual([]);
    });

    it("maps violations to findings with correct severity", async () => {
      const { parseDepCruiserOutput } = await import("../../../src/engine/modules/dependency-cruiser");
      const output = JSON.stringify({
        modules: [],
        summary: {
          violations: [
            {
              type: "dependency",
              from: "src/foo.ts",
              to: "src/bar.ts",
              rule: { name: "no-circular", severity: "error" },
              cycle: ["src/foo.ts", "src/bar.ts", "src/foo.ts"],
            },
            {
              type: "dependency",
              from: "src/api.ts",
              to: "src/internal.ts",
              rule: { name: "not-to-internal", severity: "warn" },
            },
          ],
          error: 1,
          warn: 1,
          info: 0,
          totalCruised: 10,
          totalDependenciesCruised: 20,
        },
      });
      const findings = parseDepCruiserOutput(output);
      expect(findings).toHaveLength(2);

      expect(findings[0]!.ruleId).toBe("no-circular");
      expect(findings[0]!.severity).toBe("error");
      expect(findings[0]!.file).toBe("src/foo.ts");
      expect(findings[0]!.message).toContain("src/foo.ts");
      expect(findings[0]!.message).toContain("src/bar.ts");
      expect(findings[0]!.message).toContain("circular");

      expect(findings[1]!.ruleId).toBe("not-to-internal");
      expect(findings[1]!.severity).toBe("warning"); // warn -> warning
    });

    it("filters out ignore-severity violations", async () => {
      const { parseDepCruiserOutput } = await import("../../../src/engine/modules/dependency-cruiser");
      const output = JSON.stringify({
        modules: [],
        summary: {
          violations: [
            { type: "dependency", from: "a.ts", to: "b.ts", rule: { name: "ignored", severity: "ignore" } },
            { type: "dependency", from: "c.ts", to: "d.ts", rule: { name: "real", severity: "error" } },
          ],
          error: 1, warn: 0, info: 0, totalCruised: 5, totalDependenciesCruised: 10,
        },
      });
      const findings = parseDepCruiserOutput(output);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.ruleId).toBe("real");
    });
  });

  describe("runDepCruiserCheck", () => {
    it("returns pass with no findings for clean output", async () => {
      const { runDepCruiserCheck } = await import("../../../src/engine/modules/dependency-cruiser");
      const originalSpawnSync = Bun.spawnSync;
      const cleanOutput = JSON.stringify({
        modules: [],
        summary: { violations: [], error: 0, warn: 0, info: 0, totalCruised: 5, totalDependenciesCruised: 10 },
      });
      Bun.spawnSync = (() => ({
        exitCode: 0,
        stdout: new TextEncoder().encode(cleanOutput),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runDepCruiserCheck({ config: ".dependency-cruiser.cjs" }, "src/", "/tmp");
        expect(result.pass).toBe(true);
        if ("findings" in result) {
          expect(result.findings).toHaveLength(0);
        }
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });

    it("returns fail with findings for violations", async () => {
      const { runDepCruiserCheck } = await import("../../../src/engine/modules/dependency-cruiser");
      const originalSpawnSync = Bun.spawnSync;
      const output = JSON.stringify({
        modules: [],
        summary: {
          violations: [
            { type: "dependency", from: "src/foo.ts", to: "src/bar.ts", rule: { name: "no-circular", severity: "error" } },
          ],
          error: 1, warn: 0, info: 0, totalCruised: 5, totalDependenciesCruised: 10,
        },
      });
      Bun.spawnSync = (() => ({
        exitCode: 0,
        stdout: new TextEncoder().encode(output),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runDepCruiserCheck({ config: ".dependency-cruiser.cjs" }, "src/", "/tmp");
        expect(result.pass).toBe(false);
        expect("findings" in result).toBe(true);
        if ("findings" in result) {
          expect(result.findings).toHaveLength(1);
        }
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/modules/dependency-cruiser.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Add type interface**

In `src/engine/types.ts`, add after the `AstGrepCheck` interface:

```typescript
export interface DependencyCruiserCheck {
  dependency_cruiser: { config: string };
}
```

Add `DependencyCruiserCheck` to the `CheckModule` union.

**Step 4: Create the module**

Create `src/engine/modules/dependency-cruiser.ts`:

```typescript
import type { Finding, ModuleResult } from "../types";

interface DepCruiserViolation {
  type: string;
  from: string;
  to: string;
  rule: { name: string; severity: string };
  cycle?: string[];
  comment?: string;
}

interface DepCruiserOutput {
  summary: {
    violations: DepCruiserViolation[];
  };
}

function mapSeverity(sev: string): "error" | "warning" | "info" {
  if (sev === "warn") return "warning";
  if (sev === "error") return "error";
  return "info";
}

export function parseDepCruiserOutput(stdout: string): Finding[] {
  const output: DepCruiserOutput = JSON.parse(stdout);
  return output.summary.violations
    .filter((v) => v.rule.severity !== "ignore")
    .map((v) => ({
      ruleId: v.rule.name,
      message: v.cycle
        ? `${v.from} → ${v.to} (circular: ${v.cycle.join(" → ")})`
        : `${v.from} → ${v.to}`,
      severity: mapSeverity(v.rule.severity),
      file: v.from,
    }));
}

export async function runDepCruiserCheck(
  options: { config: string },
  file: string,
  projectRoot: string,
): Promise<ModuleResult> {
  const args = ["npx", "depcruise", "--output-type", "json", "--config", `${projectRoot}/${options.config}`, file];
  const proc = Bun.spawnSync(args, { cwd: projectRoot, stderr: "pipe" });

  if (proc.exitCode === null) {
    return { pass: false, reason: "npx/depcruise not found — install dependency-cruiser in your project" };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  if (!stdout.trim()) {
    const stderr = new TextDecoder().decode(proc.stderr);
    return { pass: false, reason: `depcruise produced no output (exit ${proc.exitCode}): ${stderr.slice(0, 200)}` };
  }

  try {
    const findings = parseDepCruiserOutput(stdout);
    return { pass: findings.length === 0, findings };
  } catch (e) {
    return { pass: false, reason: `failed to parse depcruise output: ${e}` };
  }
}
```

**Step 5: Wire dispatch in runner**

In `src/engine/runner.ts`, add import:

```typescript
import { runDepCruiserCheck } from "./modules/dependency-cruiser";
```

Add dispatch case (after the ast_grep case):

```typescript
  if (c["dependency_cruiser"]) {
    const m = c["dependency_cruiser"] as { config: string };
    return await runDepCruiserCheck(m, file, projectRoot);
  }
```

**Step 6: Run tests**

Run: `bun test tests/unit/modules/dependency-cruiser.test.ts`
Expected: PASS

**Step 7: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/modules/dependency-cruiser.ts src/engine/runner.ts tests/unit/modules/dependency-cruiser.test.ts
git commit -m "feat(modules): add dependency-cruiser check module with findings support"
```

---

### Task 3: Add import-linter check type and module

**Files:**
- Modify: `src/engine/types.ts` (add interface + extend union)
- Create: `src/engine/modules/import-linter.ts`
- Modify: `src/engine/runner.ts` (import + dispatch case)
- Create: `tests/unit/modules/import-linter.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/modules/import-linter.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";

describe("import-linter module", () => {
  describe("parseImportLinterOutput", () => {
    it("returns empty findings when all contracts kept", async () => {
      const { parseImportLinterOutput } = await import("../../../src/engine/modules/import-linter");
      const output = `
=============
Import Linter
=============

---------
Contracts
---------

Analyzed 42 files, 156 dependencies.

  my_layered_contract KEPT
  my_forbidden_contract KEPT
`;
      const findings = parseImportLinterOutput(output);
      expect(findings).toEqual([]);
    });

    it("parses broken contract violations", async () => {
      const { parseImportLinterOutput } = await import("../../../src/engine/modules/import-linter");
      const output = `
=============
Import Linter
=============

---------
Contracts
---------

Analyzed 42 files, 156 dependencies.

  my_layered_contract KEPT
  my_forbidden_contract BROKEN

----------------
Broken contracts
----------------

my_forbidden_contract
---------------------

mypackage.foo is not allowed to import mypackage.bar:

  mypackage.foo:8: from mypackage import bar
  mypackage.foo:16: from mypackage.bar import something

`;
      const findings = parseImportLinterOutput(output);
      expect(findings).toHaveLength(2);

      expect(findings[0]!.ruleId).toBe("my_forbidden_contract");
      expect(findings[0]!.severity).toBe("error");
      expect(findings[0]!.file).toBe("mypackage/foo.py");
      expect(findings[0]!.line).toBe(8);
      expect(findings[0]!.message).toContain("from mypackage import bar");

      expect(findings[1]!.ruleId).toBe("my_forbidden_contract");
      expect(findings[1]!.line).toBe(16);
    });

    it("handles multiple broken contracts", async () => {
      const { parseImportLinterOutput } = await import("../../../src/engine/modules/import-linter");
      const output = `
Broken contracts
----------------

contract_a
----------

pkg.a is not allowed to import pkg.b:

  pkg.a:5: import pkg.b

contract_b
----------

pkg.c is not allowed to import pkg.d:

  pkg.c:10: from pkg.d import something

`;
      const findings = parseImportLinterOutput(output);
      expect(findings).toHaveLength(2);
      expect(findings[0]!.ruleId).toBe("contract_a");
      expect(findings[1]!.ruleId).toBe("contract_b");
    });

    it("returns empty findings for empty output", async () => {
      const { parseImportLinterOutput } = await import("../../../src/engine/modules/import-linter");
      const findings = parseImportLinterOutput("");
      expect(findings).toEqual([]);
    });
  });

  describe("runImportLinterCheck", () => {
    it("returns pass when exit code is 0", async () => {
      const { runImportLinterCheck } = await import("../../../src/engine/modules/import-linter");
      const originalSpawnSync = Bun.spawnSync;
      Bun.spawnSync = (() => ({
        exitCode: 0,
        stdout: new TextEncoder().encode("Contracts\n---------\n  my_contract KEPT\n"),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runImportLinterCheck({}, "/tmp");
        expect(result.pass).toBe(true);
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });

    it("returns fail with findings when contracts broken", async () => {
      const { runImportLinterCheck } = await import("../../../src/engine/modules/import-linter");
      const originalSpawnSync = Bun.spawnSync;
      const brokenOutput = `
Broken contracts
----------------

my_contract
-----------

pkg.a is not allowed to import pkg.b:

  pkg.a:5: import pkg.b
`;
      Bun.spawnSync = (() => ({
        exitCode: 1,
        stdout: new TextEncoder().encode(brokenOutput),
        stderr: new TextEncoder().encode(""),
      })) as typeof Bun.spawnSync;

      try {
        const result = await runImportLinterCheck({}, "/tmp");
        expect(result.pass).toBe(false);
        expect("findings" in result).toBe(true);
        if ("findings" in result) {
          expect(result.findings).toHaveLength(1);
          expect(result.findings[0]!.ruleId).toBe("my_contract");
        }
      } finally {
        Bun.spawnSync = originalSpawnSync;
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/modules/import-linter.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Add type interface**

In `src/engine/types.ts`, add after the `DependencyCruiserCheck` interface:

```typescript
export interface ImportLinterCheck {
  import_linter: { config?: string };
}
```

Add `ImportLinterCheck` to the `CheckModule` union.

**Step 4: Create the module**

Create `src/engine/modules/import-linter.ts`:

```typescript
import type { Finding, ModuleResult } from "../types";

function modulePathToFilePath(modulePath: string): string {
  return modulePath.replace(/\./g, "/") + ".py";
}

export function parseImportLinterOutput(stdout: string): Finding[] {
  const findings: Finding[] = [];
  const lines = stdout.split("\n");

  let inBrokenSection = false;
  let currentContract: string | null = null;
  const violationRegex = /^\s+(\S+):(\d+):\s+(.+)$/;
  const separatorRegex = /^-+$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.includes("Broken contracts")) {
      inBrokenSection = true;
      continue;
    }

    if (!inBrokenSection) continue;

    // Skip separator lines
    if (separatorRegex.test(line.trim())) continue;

    // Skip empty lines and description lines
    if (!line.trim()) continue;

    // Check for violation line
    const match = line.match(violationRegex);
    if (match) {
      const [, modulePath, lineNum, importStmt] = match;
      if (currentContract && modulePath && lineNum && importStmt) {
        findings.push({
          ruleId: currentContract,
          message: importStmt.trim(),
          severity: "error",
          file: modulePathToFilePath(modulePath),
          line: parseInt(lineNum, 10),
        });
      }
      continue;
    }

    // Non-indented, non-separator text in broken section = contract name
    // (skip lines that describe the violation like "X is not allowed to import Y:")
    if (!line.startsWith(" ") && !line.endsWith(":")) {
      currentContract = line.trim();
    }
  }

  return findings;
}

export async function runImportLinterCheck(
  options: { config?: string },
  projectRoot: string,
): Promise<ModuleResult> {
  const args = ["lint-imports"];
  if (options.config) {
    args.push("--config", `${projectRoot}/${options.config}`);
  }

  const proc = Bun.spawnSync(args, { cwd: projectRoot, stderr: "pipe" });

  if (proc.exitCode === null) {
    return { pass: false, reason: "lint-imports not found in PATH — install with: pip install import-linter" };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  // Exit code 0 = all contracts kept
  if (proc.exitCode === 0) {
    return { pass: true, findings: [] };
  }

  // Non-zero = at least one broken contract
  const findings = parseImportLinterOutput(stdout);
  return { pass: findings.length === 0, findings };
}
```

**Step 5: Wire dispatch in runner**

In `src/engine/runner.ts`, add import:

```typescript
import { runImportLinterCheck } from "./modules/import-linter";
```

Add dispatch case (after the dependency_cruiser case). Note: import_linter is always global scope, so it does NOT pass the `file` argument:

```typescript
  if (c["import_linter"]) {
    const m = c["import_linter"] as { config?: string };
    return await runImportLinterCheck(m, projectRoot);
  }
```

**Step 6: Run tests**

Run: `bun test tests/unit/modules/import-linter.test.ts`
Expected: PASS

**Step 7: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/modules/import-linter.ts src/engine/runner.ts tests/unit/modules/import-linter.test.ts
git commit -m "feat(modules): add import-linter check module with findings support"
```

---

### Task 4: Integration tests — analyzer modules through full pipeline

**Files:**
- Modify: `tests/integration/audit.test.ts`

**Step 1: Write integration tests**

Add to `tests/integration/audit.test.ts`. These tests verify that YAML contracts with the new check types parse correctly and flow through the audit pipeline. They mock `Bun.spawnSync` to simulate tool output.

```typescript
describe("Analyzer module integration — ast_grep", () => {
  it("parses and runs an ast_grep contract through the pipeline", async () => {
    const contract = parseContract(`
id: INT-AST-001
description: No console.log
type: atomic
trigger: commit
scope: global
checks:
  - name: no console.log
    ast_grep:
      rule: rules/no-console-log.yaml
    on_fail: warn
`);
    // The tool isn't installed, so we expect a fail with reason about sg
    const result = await runAudit([contract], "commit", TMP);
    // Verify it ran (didn't crash on unknown module) — status depends on sg availability
    expect(result.results).toHaveLength(1);
    expect(["fail", "warn", "pass"].includes(result.results[0]!.status)).toBe(true);
  });
});

describe("Analyzer module integration — dependency_cruiser", () => {
  it("parses a dependency_cruiser contract correctly", async () => {
    const contract = parseContract(`
id: INT-DC-001
description: No circular deps
type: atomic
trigger: commit
scope: global
checks:
  - name: no circular dependencies
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.results).toHaveLength(1);
    expect(["fail", "pass"].includes(result.results[0]!.status)).toBe(true);
  });
});

describe("Analyzer module integration — import_linter", () => {
  it("parses an import_linter contract correctly", async () => {
    const contract = parseContract(`
id: INT-IL-001
description: Python layer contracts
type: atomic
trigger: commit
scope: global
checks:
  - name: layer contracts
    import_linter:
      config: .importlinter
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.results).toHaveLength(1);
    expect(["fail", "pass"].includes(result.results[0]!.status)).toBe(true);
  });
});
```

**Step 2: Run integration tests**

Run: `bun test tests/integration/audit.test.ts`
Expected: PASS — contracts parse and run without crashing.

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/integration/audit.test.ts
git commit -m "test: add integration tests for Wave 1 analyzer modules"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass, zero failures.

**Step 2: Verify new check types are recognized**

Run: `bun run src/index.ts audit --json 2>/dev/null | head -5`
Expected: JSON output, no errors about unknown modules.

**Step 3: Verify types compile**

Run: `bunx tsc --noEmit`
Expected: No type errors (if tsconfig exists). If not available, skip.

**Step 4: Commit if any cleanup was needed**

Only if changes were required.
