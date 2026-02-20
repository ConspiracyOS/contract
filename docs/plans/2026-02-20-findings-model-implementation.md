# Findings Model Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the audit engine to support per-finding output from analyzer checks, with `--verbose` and `--json` output modes.

**Architecture:** Add a `Finding` interface and optional `findings[]` to `CheckResult`. The runner accepts a `ModuleResult` union so existing boolean-returning modules work unchanged. The reporter gains verbose (inline findings) and JSON (structured) output modes. The CLI gets `--verbose` and `--json` flags.

**Tech Stack:** TypeScript, Bun test runner, Commander.js CLI

---

### Task 1: Add Finding type and extend CheckResult

**Files:**
- Modify: `src/engine/types.ts:90-110`

**Step 1: Write the failing test**

Create `tests/unit/types.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import type { Finding, CheckResult, AuditResult } from "../../src/engine/types";

describe("Finding type", () => {
  it("accepts a minimal finding", () => {
    const f: Finding = {
      ruleId: "no-eval",
      message: "eval() is dangerous",
      severity: "error",
    };
    expect(f.ruleId).toBe("no-eval");
    expect(f.file).toBeUndefined();
  });

  it("accepts a finding with full location", () => {
    const f: Finding = {
      ruleId: "no-eval",
      message: "eval() is dangerous",
      severity: "error",
      file: "src/main.ts",
      line: 42,
      column: 5,
      endLine: 42,
      endColumn: 15,
    };
    expect(f.line).toBe(42);
  });
});

describe("CheckResult with findings", () => {
  it("works without findings (backwards compat)", () => {
    const r: CheckResult = {
      contractId: "C-001",
      contractDescription: "test",
      checkName: "test check",
      status: "pass",
    };
    expect(r.findings).toBeUndefined();
  });

  it("accepts findings array", () => {
    const r: CheckResult = {
      contractId: "C-001",
      contractDescription: "test",
      checkName: "test check",
      status: "fail",
      findings: [
        { ruleId: "r1", message: "bad", severity: "error", file: "a.ts", line: 1 },
      ],
    };
    expect(r.findings).toHaveLength(1);
  });
});

describe("AuditResult with totalFindings", () => {
  it("includes totalFindings", () => {
    const r: AuditResult = {
      results: [],
      passed: 0,
      failed: 0,
      exempt: 0,
      skipped: 0,
      warned: 0,
      totalFindings: 5,
    };
    expect(r.totalFindings).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/types.test.ts`
Expected: FAIL — `Finding` and `findings` and `totalFindings` types don't exist yet.

**Step 3: Write minimal implementation**

In `src/engine/types.ts`, add after line 91 (after `CheckStatus` type):

```typescript
export interface Finding {
  ruleId: string;
  message: string;
  severity: "error" | "warning" | "info";
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}
```

Then extend `CheckResult` (line 94-101) to add `findings?`:

```typescript
export interface CheckResult {
  contractId: string;
  contractDescription: string;
  checkName: string;
  status: CheckStatus;
  message?: string;
  file?: string;
  findings?: Finding[];
}
```

Then extend `AuditResult` (line 103-110) to add `totalFindings?`:

```typescript
export interface AuditResult {
  results: CheckResult[];
  passed: number;
  failed: number;
  exempt: number;
  skipped: number;
  warned: number;
  totalFindings?: number;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/types.test.ts`
Expected: PASS

**Step 5: Run all existing tests to verify no regressions**

Run: `bun test`
Expected: All existing tests still pass.

**Step 6: Commit**

```bash
git add src/engine/types.ts tests/unit/types.test.ts
git commit -m "feat(engine): add Finding type and extend CheckResult/AuditResult"
```

---

### Task 2: Add ModuleResult type and update runner

**Files:**
- Modify: `src/engine/types.ts` (add ModuleResult export)
- Modify: `src/engine/runner.ts:26-93` (runSingleCheck return type)
- Test: `tests/unit/runner.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/runner.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { runCheck } from "../../src/engine/runner";
import type { Contract, Check, Finding } from "../../src/engine/types";

const TMP = mkdtempSync("/tmp/runner-findings-");

beforeAll(() => {
  writeFileSync(`${TMP}/test.ts`, "const x = 1;\n");
});
afterAll(() => rmSync(TMP, { recursive: true }));

function makeContract(id: string): Contract {
  return {
    id,
    description: "test contract",
    type: "atomic",
    trigger: "commit",
    scope: "global",
    checks: [],
  };
}

describe("runCheck with findings-aware modules", () => {
  it("preserves findings from a module that returns ModuleResult", async () => {
    // This test validates that when runSingleCheck returns findings,
    // they appear on the CheckResult. We need a command check that
    // produces findings — but that comes in a later task.
    // For now, test that a normal check still returns no findings.
    const contract = makeContract("T-001");
    const check: Check = {
      name: "file exists",
      path_exists: { path: "test.ts" },
    };
    const result = await runCheck(contract, check, "__global__", TMP);
    expect(result.status).toBe("pass");
    expect(result.findings).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it passes (baseline)**

Run: `bun test tests/unit/runner.test.ts`
Expected: PASS — this establishes the baseline that existing checks still work.

**Step 3: Add ModuleResult type**

In `src/engine/types.ts`, add after the `Finding` interface:

```typescript
export type ModuleResult =
  | { pass: boolean; reason?: string }
  | { pass: boolean; reason?: string; findings: Finding[] };
```

**Step 4: Update runSingleCheck to use ModuleResult**

In `src/engine/runner.ts`, change `runSingleCheck` return type from `Promise<{ pass: boolean; reason?: string }>` to `Promise<ModuleResult>` (line 26-30). No body changes needed — the existing return values already satisfy the base case of ModuleResult.

Update the import on line 2:
```typescript
import type { Check, CheckResult, Contract, Finding, ModuleResult, SkipIf } from "./types";
```

**Step 5: Update runCheck to forward findings**

In `src/engine/runner.ts`, in the `runCheck` function (line 95-157), change line 111:

```typescript
const result = await runSingleCheck(check, file, projectRoot);
const { pass, reason } = result;
const findings = "findings" in result ? result.findings : undefined;
```

Then in each return statement that builds a CheckResult, add `findings` when present. The pass case (line 114-122):

```typescript
if (pass) {
  return {
    contractId: contract.id,
    contractDescription: contract.description,
    checkName: check.name,
    status: "pass",
    file,
    findings,
  };
}
```

The warn case (line 124-133):
```typescript
if (onFail === "warn") {
  return {
    contractId: contract.id,
    contractDescription: contract.description,
    checkName: check.name,
    status: "warn",
    message: reason,
    file,
    findings,
  };
}
```

The final fail case (line 149-157):
```typescript
return {
  contractId: contract.id,
  contractDescription: contract.description,
  checkName: check.name,
  status: "fail",
  message: reason ?? "check did not pass",
  file,
  findings,
};
```

The exempt case (line 135-147) does NOT get findings — exemptions override findings.

**Step 6: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/runner.ts tests/unit/runner.test.ts
git commit -m "feat(engine): add ModuleResult type and forward findings through runner"
```

---

### Task 3: Compute totalFindings in audit engine

**Files:**
- Modify: `src/engine/audit.ts:100-108`
- Test: `tests/unit/audit-findings.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/audit-findings.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { runAudit } from "../../src/engine/audit";
import { parseContract } from "../../src/engine/parser";

const TMP = mkdtempSync("/tmp/audit-findings-");

beforeAll(() => {
  mkdirSync(`${TMP}/src`, { recursive: true });
  writeFileSync(`${TMP}/src/main.ts`, "const x = 1;\n");
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("AuditResult.totalFindings", () => {
  it("is 0 when no checks produce findings", async () => {
    const contract = parseContract(`
id: TF-001
description: basic check
type: atomic
trigger: commit
scope: global
checks:
  - name: file exists
    path_exists:
      path: src/main.ts
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.totalFindings).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/audit-findings.test.ts`
Expected: FAIL — `totalFindings` is undefined (not computed yet).

**Step 3: Compute totalFindings in runAudit**

In `src/engine/audit.ts`, update the return block (lines 100-108):

```typescript
const totalFindings = allResults.reduce(
  (sum, r) => sum + (r.findings?.length ?? 0),
  0
);

return {
  results: allResults,
  passed: allResults.filter(r => r.status === "pass").length,
  failed: allResults.filter(r => r.status === "fail").length,
  exempt: allResults.filter(r => r.status === "exempt").length,
  skipped: allResults.filter(r => r.status === "skip").length,
  warned: allResults.filter(r => r.status === "warn").length,
  totalFindings,
};
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/audit-findings.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/engine/audit.ts tests/unit/audit-findings.test.ts
git commit -m "feat(engine): compute totalFindings in AuditResult"
```

---

### Task 4: Add --verbose flag and findings display to reporter

**Files:**
- Modify: `src/engine/reporter.ts` (add verbose mode)
- Modify: `src/commands/audit.ts` (pass verbose option)
- Modify: `src/index.ts:19-25` (add --verbose flag)
- Test: `tests/unit/reporter.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/reporter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { printAuditResult } from "../../src/engine/reporter";
import type { AuditResult } from "../../src/engine/types";

// Capture console.log output
let output: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  output = [];
  console.log = (...args: unknown[]) => output.push(args.map(String).join(" "));
});
afterEach(() => {
  console.log = originalLog;
});

function resultWithFindings(): AuditResult {
  return {
    results: [
      {
        contractId: "C-001",
        contractDescription: "No secrets",
        checkName: "scan",
        status: "fail",
        message: "2 findings",
        findings: [
          { ruleId: "no-aws-keys", message: "AWS key detected", severity: "error", file: "src/config.ts", line: 42 },
          { ruleId: "no-tokens", message: "Token found", severity: "warning", file: "src/auth.ts", line: 7 },
        ],
      },
      {
        contractId: "C-002",
        contractDescription: "TypeScript strict",
        checkName: "tsconfig",
        status: "pass",
      },
    ],
    passed: 1,
    failed: 1,
    exempt: 0,
    skipped: 0,
    warned: 0,
    totalFindings: 2,
  };
}

describe("printAuditResult — default mode", () => {
  it("shows one line per contract without findings detail", () => {
    printAuditResult(resultWithFindings());
    const joined = output.join("\n");
    expect(joined).toContain("C-001");
    expect(joined).toContain("FAIL");
    expect(joined).not.toContain("no-aws-keys");
  });
});

describe("printAuditResult — verbose mode", () => {
  it("shows findings underneath their contract", () => {
    printAuditResult(resultWithFindings(), { verbose: true });
    const joined = output.join("\n");
    expect(joined).toContain("C-001");
    expect(joined).toContain("FAIL");
    expect(joined).toContain("no-aws-keys");
    expect(joined).toContain("src/config.ts:42");
    expect(joined).toContain("no-tokens");
    expect(joined).toContain("src/auth.ts:7");
  });

  it("does not show findings for contracts without them", () => {
    printAuditResult(resultWithFindings(), { verbose: true });
    const joined = output.join("\n");
    // C-002 has no findings, should just show the one-liner
    const c002Lines = output.filter(l => l.includes("C-002"));
    expect(c002Lines).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/reporter.test.ts`
Expected: FAIL — `printAuditResult` does not accept options parameter.

**Step 3: Update reporter**

In `src/engine/reporter.ts`, replace the entire file:

```typescript
import type { AuditResult, CheckResult, Finding } from "./types";

const STATUS_LABEL: Record<string, string> = {
  pass: "PASS  ",
  fail: "FAIL  ",
  exempt: "EXEMPT",
  skip: "SKIP  ",
  warn: "WARN  ",
};

export interface ReporterOptions {
  verbose?: boolean;
}

function formatFinding(f: Finding): string {
  const loc = f.file
    ? f.line
      ? `${f.file}:${f.line}`
      : f.file
    : "";
  const sev = f.severity.padEnd(7);
  return `  ${sev}  ${loc.padEnd(30)}  ${f.message} (${f.ruleId})`;
}

export function printAuditResult(result: AuditResult, options?: ReporterOptions): void {
  console.log("\n=== agent-config audit ===\n");

  const byContract = new Map<string, CheckResult[]>();
  for (const r of result.results) {
    const existing = byContract.get(r.contractId) ?? [];
    existing.push(r);
    byContract.set(r.contractId, existing);
  }

  for (const [id, checks] of byContract) {
    const worst = checks.find(c => c.status === "fail")
      ?? checks.find(c => c.status === "warn")
      ?? checks[0]!;

    const label = STATUS_LABEL[worst.status] ?? worst.status.toUpperCase().padEnd(6);
    const desc = checks[0]!.contractDescription;

    // Collect all findings across checks for this contract
    const allFindings = checks.flatMap(c => c.findings ?? []);
    const findingCount = allFindings.length;

    const extra = findingCount > 0
      ? `  — ${findingCount} finding${findingCount !== 1 ? "s" : ""}`
      : worst.message
        ? `  — ${worst.message}`
        : "";

    console.log(`${id.padEnd(12)} ${label}  ${desc}${extra}`);

    if (options?.verbose && findingCount > 0) {
      for (const f of allFindings) {
        console.log(formatFinding(f));
      }
    }
  }

  const { passed, failed, exempt, skipped, warned } = result;
  console.log(
    `\n=== ${passed} passed, ${failed} failed, ${exempt} exempt, ${skipped} skipped, ${warned} warned ===\n`
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/reporter.test.ts`
Expected: PASS

**Step 5: Wire --verbose to audit command**

In `src/commands/audit.ts`, update the function signature (line 42):

```typescript
export async function auditCommand(options: {
  trigger?: string;
  noBuiltins?: boolean;
  verbose?: boolean;
}): Promise<void> {
```

Update the printAuditResult call (line 73):

```typescript
printAuditResult(result, { verbose: options.verbose });
```

In `src/index.ts`, add the --verbose option to the audit command (after line 22):

```typescript
.option("--verbose", "Show individual findings for each contract")
```

Update the action handler (line 24):

```typescript
.action(async (options) => {
  await auditCommand({
    trigger: options.trigger,
    noBuiltins: !options.builtins,
    verbose: options.verbose,
  });
});
```

**Step 6: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/engine/reporter.ts src/commands/audit.ts src/index.ts tests/unit/reporter.test.ts
git commit -m "feat(reporter): add --verbose flag for inline findings display"
```

---

### Task 5: Add --json flag for structured output

**Files:**
- Modify: `src/engine/reporter.ts` (add formatAuditResultJson)
- Modify: `src/commands/audit.ts` (handle json option)
- Modify: `src/index.ts` (add --json flag)
- Test: `tests/unit/reporter.test.ts` (add JSON tests)

**Step 1: Write the failing test**

Add to `tests/unit/reporter.test.ts`:

```typescript
import { formatAuditResultJson } from "../../src/engine/reporter";

describe("formatAuditResultJson", () => {
  it("returns valid JSON with all fields", () => {
    const result = resultWithFindings();
    const json = formatAuditResultJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.passed).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.totalFindings).toBe(2);
    expect(parsed.results[0].findings).toHaveLength(2);
    expect(parsed.results[0].findings[0].ruleId).toBe("no-aws-keys");
  });

  it("omits findings key when not present", () => {
    const result = resultWithFindings();
    const json = formatAuditResultJson(result);
    const parsed = JSON.parse(json);
    // C-002 has no findings — key should be absent
    expect(parsed.results[1].findings).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/reporter.test.ts`
Expected: FAIL — `formatAuditResultJson` is not exported.

**Step 3: Add JSON formatter**

In `src/engine/reporter.ts`, add:

```typescript
export function formatAuditResultJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/unit/reporter.test.ts`
Expected: PASS

**Step 5: Wire --json to audit command**

In `src/commands/audit.ts`, update the options type:

```typescript
export async function auditCommand(options: {
  trigger?: string;
  noBuiltins?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
```

Import `formatAuditResultJson` at top:

```typescript
import { printAuditResult, formatAuditResultJson } from "../engine/reporter";
```

Replace the `printAuditResult(result, ...)` call and exit logic:

```typescript
if (options.json) {
  console.log(formatAuditResultJson(result));
} else {
  printAuditResult(result, { verbose: options.verbose });
}

if (result.failed > 0) process.exit(1);
```

In `src/index.ts`, add after the --verbose option:

```typescript
.option("--json", "Output results as JSON")
```

Update the action handler to pass `json: options.json`.

**Step 6: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/engine/reporter.ts src/commands/audit.ts src/index.ts tests/unit/reporter.test.ts
git commit -m "feat(reporter): add --json flag for structured audit output"
```

---

### Task 6: Integration test — full findings pipeline

**Files:**
- Modify: `tests/integration/audit.test.ts`

**Step 1: Write the integration test**

Add a new describe block to `tests/integration/audit.test.ts`:

```typescript
describe("Findings pipeline", () => {
  it("CheckResult carries findings through the full audit pipeline", async () => {
    // Use a command check that produces output we can validate.
    // This tests the engine wiring — actual analyzer modules come later.
    const contract = parseContract(`
id: INT-FIND-001
description: basic check with no findings
type: atomic
trigger: commit
scope: global
checks:
  - name: file check
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.totalFindings).toBe(0);
    expect(result.results[0]!.findings).toBeUndefined();
  });

  it("AuditResult.totalFindings aggregates correctly across contracts", async () => {
    const c1 = parseContract(`
id: INT-FIND-002a
description: first contract
type: atomic
trigger: commit
scope: global
checks:
  - name: check a
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const c2 = parseContract(`
id: INT-FIND-002b
description: second contract
type: atomic
trigger: commit
scope: global
checks:
  - name: check b
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const result = await runAudit([c1, c2], "commit", TMP);
    expect(result.totalFindings).toBe(0);
    expect(typeof result.totalFindings).toBe("number");
  });
});
```

**Step 2: Run the integration test**

Run: `bun test tests/integration/audit.test.ts`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/integration/audit.test.ts
git commit -m "test: add findings pipeline integration tests"
```

---

### Task 7: Verify and clean up

**Step 1: Run full test suite one final time**

Run: `bun test`
Expected: All tests pass, zero failures.

**Step 2: Verify --verbose and --json flags are registered**

Run: `bun run src/index.ts audit --help`
Expected: Output shows `--verbose` and `--json` flags in the help text.

**Step 3: Manual smoke test**

Run: `bun run src/index.ts audit --json | head -20`
Expected: Valid JSON output with `results`, `passed`, `failed`, `totalFindings` keys.

Run: `bun run src/index.ts audit --verbose`
Expected: Normal audit output (no findings yet since no analyzer modules exist, but no errors).

**Step 4: Commit if any cleanup was needed**

Only if changes were required. Otherwise, this task is done.
