# Phase 2 Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete remaining Phase 2 items: replace C-PROC01 stub with real C-SEC02 secrets scanner, add syntax kit contracts for TypeScript/Elixir/Rails/Shell, add shell stack detection.

**Architecture:** Six independent tasks in dependency order: (1) C-SEC02 replaces C-PROC01 in proc.ts, (2) C-TS03 in typescript.ts, (3) C-EX03 in elixir.ts, (4) C-RB04 in rails.ts, (5) shell stack + C-SH01/C-SH02, (6) wire shell stack in index.ts + detector.ts. Each task is independently testable via `bun test`.

**Tech Stack:** Bun + TypeScript (strict), js-yaml, zod. All contracts expressed as YAML strings in TypeScript files — no engine changes needed.

---

## Task 1: Replace C-PROC01 with C-SEC02

**Files:**
- Modify: `src/builtins/proc.ts:5-19`
- Test: `tests/integration/audit.test.ts`

**Step 1: Write the failing test**

Add to `tests/integration/audit.test.ts` at the end of the file (before final closing — just append a new describe block):

```typescript
describe("C-SEC02 secrets scan contract", () => {
  it("parses and runs the C-SEC02 builtin contract", async () => {
    // Import and parse the builtin to ensure it's valid YAML
    const { PROC_CONTRACTS } = await import("../../src/builtins/proc");
    const { parseContract } = await import("../../src/engine/parser");
    const sec02 = PROC_CONTRACTS.find(c => c.includes("C-SEC02"));
    expect(sec02).toBeDefined();
    const contract = parseContract(sec02!);
    expect(contract.id).toBe("C-SEC02");
    expect(contract.checks[0]!.on_fail).toBe("warn");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/integration/audit.test.ts`
Expected: FAIL — no contract contains "C-SEC02"

**Step 3: Replace C-PROC01 with C-SEC02 in `src/builtins/proc.ts`**

Replace lines 5-19 (the C-PROC01 entry) with:

```typescript
  // C-SEC02: Real secrets scan using gitleaks or trufflehog
  `id: C-SEC02
description: Source must pass secrets scan (gitleaks or trufflehog)
type: atomic
trigger: pr
scope: global
checks:
  - name: secrets scan
    command:
      run: "if command -v gitleaks >/dev/null 2>&1; then gitleaks detect --no-git --source . --exit-code 1 2>&1; elif command -v trufflehog >/dev/null 2>&1; then trufflehog filesystem . --only-verified --fail 2>&1; else echo 'No secrets scanner found. Install: brew install gitleaks'; exit 1; fi"
      exit_code: 0
    on_fail: warn`,
```

Also update the comment on line 2 to remove the reference to C-PROC01:

```typescript
// Built-in process contracts as YAML strings — bundled with binary
```

(Remove line 6 comment `// C-PROC01: No secrets in git history`)

**Step 4: Run test to verify it passes**

Run: `bun test tests/integration/audit.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/builtins/proc.ts tests/integration/audit.test.ts
git commit -m "feat(contracts): replace C-PROC01 stub with C-SEC02 secrets scanner

Uses gitleaks if available, falls back to trufflehog, warns if
neither installed with install suggestion."
```

---

## Task 2: Add C-TS03 — `use client` annotation

**Files:**
- Modify: `src/stacks/typescript.ts:27`
- Test: `tests/integration/audit.test.ts`

**Step 1: Write the failing test**

Append to `tests/integration/audit.test.ts`:

```typescript
describe("C-TS03 use client annotation", () => {
  it("fails when use client has no annotation comment", async () => {
    writeFileSync(`${TMP}/src/ClientComp.tsx`, '"use client";\nexport default function Foo() { return null; }\n');
    const contract = parseContract(`
id: C-TS03
description: use client directive requires annotation
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx"]
  exclude: ["**/*.test.tsx"]
checks:
  - name: use client requires annotation
    no_regex_in_file:
      pattern: '"use client"(?!.*@pattern:client-component)'
    on_fail: require_exemption
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(1);
  });

  it("passes when use client has annotation", async () => {
    writeFileSync(`${TMP}/src/AnnotatedClient.tsx`, '"use client"; // @pattern:client-component:reason=form-state\nexport default function Bar() { return null; }\n');
    const contract = parseContract(`
id: C-TS03
description: use client directive requires annotation
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx"]
  exclude: ["**/*.test.tsx"]
checks:
  - name: use client requires annotation
    no_regex_in_file:
      pattern: '"use client"(?!.*@pattern:client-component)'
    on_fail: require_exemption
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.results.filter(r => r.file?.includes("AnnotatedClient")).every(r => r.status === "pass")).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes** (contract is inline, not from builtin yet)

Run: `bun test tests/integration/audit.test.ts`
Expected: PASS (we're testing the contract YAML directly)

**Step 3: Add C-TS03 to `src/stacks/typescript.ts`**

Add after the C-TS02 entry (after line 26, before the closing `];`):

```typescript

  `id: C-TS03
description: use client directive requires annotation
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx"]
  exclude: ["**/*.test.tsx"]
checks:
  - name: use client requires annotation
    no_regex_in_file:
      pattern: '"use client"(?!.*@pattern:client-component)'
    on_fail: require_exemption`,
```

**Step 4: Verify builtin parses correctly**

Add a quick parse test to the C-TS03 describe block:

```typescript
  it("parses C-TS03 from builtins", async () => {
    const { TS_CONTRACTS } = await import("../../src/stacks/typescript");
    const { parseContract } = await import("../../src/engine/parser");
    const ts03 = TS_CONTRACTS.find(c => c.includes("C-TS03"));
    expect(ts03).toBeDefined();
    const contract = parseContract(ts03!);
    expect(contract.id).toBe("C-TS03");
  });
```

**Step 5: Run all tests**

Run: `bun test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/stacks/typescript.ts tests/integration/audit.test.ts
git commit -m "feat(contracts): add C-TS03 — use client requires annotation"
```

---

## Task 3: Add C-EX03 — Public functions must have @spec

**Files:**
- Modify: `src/stacks/elixir.ts:44`
- Test: `tests/integration/audit.test.ts`

**Step 1: Write the test**

Append to `tests/integration/audit.test.ts`:

```typescript
describe("C-EX03 @spec enforcement", () => {
  it("parses C-EX03 from builtins", async () => {
    const { EX_CONTRACTS } = await import("../../src/stacks/elixir");
    const { parseContract } = await import("../../src/engine/parser");
    const ex03 = EX_CONTRACTS.find(c => c.includes("C-EX03"));
    expect(ex03).toBeDefined();
    const contract = parseContract(ex03!);
    expect(contract.id).toBe("C-EX03");
    expect(contract.checks[0]!.skip_if).toEqual({ command_not_available: "mix" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/integration/audit.test.ts`
Expected: FAIL — no C-EX03 in elixir.ts

**Step 3: Add C-EX03 to `src/stacks/elixir.ts`**

Add after C-EX04 (after line 43, before closing `];`):

```typescript

  `id: C-EX03
description: Public Elixir functions must have @spec
type: atomic
trigger: pr
scope: global
checks:
  - name: credo specs check
    command:
      run: "mix credo --only Credo.Check.Readability.Specs --strict 2>&1 | tail -3"
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: mix`,
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/stacks/elixir.ts tests/integration/audit.test.ts
git commit -m "feat(contracts): add C-EX03 — @spec enforcement via credo"
```

---

## Task 4: Add C-RB04 — Bullet gem for N+1 detection

**Files:**
- Modify: `src/stacks/rails.ts:41`
- Test: `tests/integration/audit.test.ts`

**Step 1: Write the test**

Append to `tests/integration/audit.test.ts`:

```typescript
describe("C-RB04 bullet gem", () => {
  it("parses C-RB04 from builtins", async () => {
    const { RB_CONTRACTS } = await import("../../src/stacks/rails");
    const { parseContract } = await import("../../src/engine/parser");
    const rb04 = RB_CONTRACTS.find(c => c.includes("C-RB04"));
    expect(rb04).toBeDefined();
    const contract = parseContract(rb04!);
    expect(contract.id).toBe("C-RB04");
  });

  it("warns when Gemfile exists but lacks bullet", async () => {
    writeFileSync(`${TMP}/Gemfile`, 'gem "rails"\ngem "pg"\n');
    const { RB_CONTRACTS } = await import("../../src/stacks/rails");
    const { parseContract } = await import("../../src/engine/parser");
    const contract = parseContract(RB_CONTRACTS.find(c => c.includes("C-RB04"))!);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.warned).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/integration/audit.test.ts`
Expected: FAIL — no C-RB04

**Step 3: Add C-RB04 to `src/stacks/rails.ts`**

Add after C-RB03 (after line 40, before closing `];`):

```typescript

  `id: C-RB04
description: Bullet gem must be present for N+1 detection
type: atomic
trigger: commit
scope:
  paths: ["Gemfile"]
checks:
  - name: bullet gem in Gemfile
    regex_in_file:
      pattern: "bullet"
    on_fail: warn
    skip_if:
      path_not_exists: Gemfile`,
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/stacks/rails.ts tests/integration/audit.test.ts
git commit -m "feat(contracts): add C-RB04 — bullet gem for N+1 detection"
```

---

## Task 5: Create shell stack with C-SH01 and C-SH02

**Files:**
- Create: `src/stacks/shell.ts`
- Test: `tests/integration/audit.test.ts`

**Step 1: Write the tests**

Append to `tests/integration/audit.test.ts`:

```typescript
describe("Shell stack contracts", () => {
  beforeAll(() => {
    mkdirSync(`${TMP}/scripts`, { recursive: true });
    writeFileSync(`${TMP}/scripts/good.sh`, '#!/usr/bin/env bash\nset -euo pipefail\necho "hello"\n');
    writeFileSync(`${TMP}/scripts/bad-shebang.sh`, '#!/bin/sh\necho "hello"\n');
    writeFileSync(`${TMP}/scripts/bad-strict.sh`, '#!/usr/bin/env bash\necho "hello"\n');
  });

  it("parses C-SH01 and C-SH02 from builtins", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    const { parseContract } = await import("../../src/engine/parser");
    expect(SH_CONTRACTS).toHaveLength(2);
    const sh01 = parseContract(SH_CONTRACTS[0]!);
    const sh02 = parseContract(SH_CONTRACTS[1]!);
    expect(sh01.id).toBe("C-SH01");
    expect(sh02.id).toBe("C-SH02");
  });

  it("C-SH01 passes for bash shebang, fails for sh shebang", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    const { parseContract } = await import("../../src/engine/parser");
    const contract = parseContract(SH_CONTRACTS[0]!);
    const result = await runAudit([contract], "commit", TMP);
    const passes = result.results.filter(r => r.status === "pass");
    const fails = result.results.filter(r => r.status === "fail");
    expect(passes.length).toBe(1); // good.sh
    expect(fails.length).toBe(2); // bad-shebang.sh, bad-strict.sh (missing #!/usr/bin/env bash)
  });

  it("C-SH02 passes for strict mode, fails without it", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    const { parseContract } = await import("../../src/engine/parser");
    const contract = parseContract(SH_CONTRACTS[1]!);
    const result = await runAudit([contract], "commit", TMP);
    const passes = result.results.filter(r => r.status === "pass");
    const fails = result.results.filter(r => r.status === "fail");
    expect(passes.length).toBe(1); // good.sh
    expect(fails.length).toBe(2); // bad-shebang.sh + bad-strict.sh
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/integration/audit.test.ts`
Expected: FAIL — module not found

**Step 3: Create `src/stacks/shell.ts`**

```typescript
// src/stacks/shell.ts
export const SH_CONTRACTS = [
  `id: C-SH01
description: Shell scripts must use bash shebang
type: atomic
trigger: commit
scope:
  paths: ["scripts/**/*.sh"]
checks:
  - name: bash shebang present
    regex_in_file:
      pattern: "^#!/usr/bin/env bash"
    on_fail: fail`,

  `id: C-SH02
description: Shell scripts must use strict mode
type: atomic
trigger: commit
scope:
  paths: ["scripts/**/*.sh"]
checks:
  - name: strict mode set
    regex_in_file:
      pattern: "set -euo pipefail"
    on_fail: fail`,
];
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/integration/audit.test.ts`
Expected: All pass

**Step 5: Commit**

```bash
git add src/stacks/shell.ts tests/integration/audit.test.ts
git commit -m "feat(contracts): add shell stack — C-SH01 shebang, C-SH02 strict mode"
```

---

## Task 6: Wire shell stack into builtins + detector

**Files:**
- Modify: `src/builtins/index.ts:1-24`
- Modify: `src/init/detector.ts:4,13`
- Test: `tests/init/detector.test.ts`

**Step 1: Write the failing test**

Add to `tests/init/detector.test.ts`:

```typescript
  it("detects shell stack when scripts/ dir exists", async () => {
    mkdirSync(`${TMP}/scripts`, { recursive: true });
    writeFileSync(`${TMP}/scripts/deploy.sh`, "#!/bin/bash\n");
    const stacks = await detectStacks(TMP);
    expect(stacks).toContain("shell");
    rmSync(`${TMP}/scripts`, { recursive: true });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/init/detector.test.ts`
Expected: FAIL — "shell" not in Stack type

**Step 3: Update `src/init/detector.ts`**

Add `"shell"` to the Stack type on line 4:

```typescript
export type Stack = "typescript" | "python" | "elixir" | "rust" | "rails" | "mobile" | "containers" | "shell";
```

Add shell detection to STACK_SIGNALS array on line 13 (before the closing `];`):

```typescript
  { stack: "shell", files: ["scripts"] },
```

Note: `existsSync` returns true for directories too, so checking for `scripts` (directory) works.

**Step 4: Run detector test to verify it passes**

Run: `bun test tests/init/detector.test.ts`
Expected: PASS

**Step 5: Wire shell into `src/builtins/index.ts`**

Add import after line 9:

```typescript
import { SH_CONTRACTS } from "../stacks/shell";
```

Add loading after line 22:

```typescript
  if (stacks.includes("shell")) yamls.push(...SH_CONTRACTS);
```

**Step 6: Run all tests**

Run: `bun test`
Expected: All pass

**Step 7: Commit**

```bash
git add src/builtins/index.ts src/init/detector.ts tests/init/detector.test.ts
git commit -m "feat(stacks): wire shell stack into builtins and detector"
```

---

## Phase 2 Addendum: Language Coverage Hardening

Keep these changes scoped to Phase 2 (no Phase 3 renaming):

1. Add Go stack contracts (`C-GO01`, `C-GO02`, `C-GO03`) in `src/stacks/go.ts`.
2. Add JavaScript stack contracts (`C-JS01`, `C-JS02`, `C-JS03`) in `src/stacks/javascript.ts`.
3. Wire Go + JavaScript stacks into builtin loading in `src/builtins/index.ts`.
4. Harden stack detector semantics in `src/init/detector.ts`:
   - TypeScript requires `tsconfig.json` (no `package.json`-only false positive).
   - Rails requires `config/application.rb` (no `Gemfile`-only false positive).
   - JavaScript detects with `package.json` and no `tsconfig.json`.
   - Go detects with `go.mod`.
5. Add detector tests for the new rules in `tests/init/detector.test.ts`.
6. Add builtin parse coverage tests for Go + JavaScript contracts in `tests/integration/audit.test.ts`.
