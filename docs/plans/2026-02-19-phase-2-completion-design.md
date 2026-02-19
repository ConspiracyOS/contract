# Phase 2 Completion — Design

**Status**: Approved
**Date**: 2026-02-19
**Scope**: Complete remaining Phase 2 items: C-SEC02 secrets scanning, syntax kit contracts, shell stack.

---

## Group A: C-SEC02 — Secrets scanning

Replace the C-PROC01 stub (`git log | head -1`) with a real secrets scanner contract.

**Approach**: Single `command` check with inline shell that tries gitleaks first, falls back to trufflehog, warns if neither installed.

```yaml
id: C-SEC02
description: Source must pass secrets scan (gitleaks or trufflehog)
type: atomic
trigger: pr
scope: global
checks:
  - name: secrets scan
    command:
      run: |
        if command -v gitleaks >/dev/null 2>&1; then
          gitleaks detect --no-git --source . --exit-code 1 2>&1
        elif command -v trufflehog >/dev/null 2>&1; then
          trufflehog filesystem . --only-verified --fail 2>&1
        else
          echo "No secrets scanner found. Install: brew install gitleaks" >&2
          exit 1
        fi
      exit_code: 0
    on_fail: warn
```

- Secrets found → exit 1 → WARN (advisory by default; projects can override with `on_fail: fail`)
- Neither tool installed → exit 1 → WARN with install suggestion
- Clean scan → exit 0 → PASS
- Replaces C-PROC01 entirely (remove C-PROC01)

## Group B: Syntax kit contracts

All expressible with existing check modules. No engine changes.

### C-TS03 — `use client` requires annotation (TypeScript)

```yaml
- name: use client requires annotation
  no_regex_in_file:
    pattern: '"use client"(?!.*@pattern:client-component)'
  on_fail: require_exemption
```

Scope: `src/**/*.tsx` excluding test files.

### C-EX03 — Public functions must have @spec (Elixir)

```yaml
- name: credo specs check
  command:
    run: "mix credo --only Credo.Check.Readability.Specs --strict 2>&1 | tail -3"
    exit_code: 0
  on_fail: warn
  skip_if:
    command_not_available: mix
```

### C-RB04 — Bullet gem required for N+1 detection (Rails)

```yaml
- name: bullet gem in Gemfile
  regex_in_file:
    pattern: "bullet"
  on_fail: warn
  skip_if:
    path_not_exists: Gemfile
```

Scope: `Gemfile` only.

### C-SH01 + C-SH02 — Shell script hygiene (new stack)

```yaml
id: C-SH01
scope:
  paths: ["scripts/**/*.sh"]
checks:
  - name: bash shebang present
    regex_in_file:
      pattern: "^#!/usr/bin/env bash"
    on_fail: fail

id: C-SH02
checks:
  - name: strict mode set
    regex_in_file:
      pattern: "set -euo pipefail"
    on_fail: fail
```

New stack auto-detected when `scripts/` directory exists.

## Group C: Elixir Credo split

Already correct: C-EX01 (format) is `trigger: commit`, C-EX02 (credo strict) is `trigger: pr`. No changes needed.

## Dropped

- React `useState`/`useEffect` overuse check — requires AST analysis, not feasible with regex.

## Files changed

- `src/builtins/proc.ts` — remove C-PROC01, add C-SEC02
- `src/stacks/typescript.ts` — add C-TS03
- `src/stacks/elixir.ts` — add C-EX03
- `src/stacks/rails.ts` — add C-RB04
- `src/stacks/shell.ts` — new file (C-SH01, C-SH02)
- `src/builtins/index.ts` — wire shell stack
- `src/init/detector.ts` — detect shell stack
- Tests for each new contract
