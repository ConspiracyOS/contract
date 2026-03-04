# contracts

A contract enforcement binary for any git project. Define machine-readable invariants
in YAML, tag them for the contexts they apply to (git hooks, schedules, agent tool-use,
etc.), and optionally dispatch failures to any shell command (webhook, PagerDuty, Slack, etc.).

Works standalone — no ConspiracyOS installation required.

## Quick start

```bash
go install github.com/ConspiracyOS/contracts/cmd/contracts@latest

cd your-project
contracts init        # creates .contracts/ + installs git hooks
contracts check       # run all contracts
contracts check --tags pre-commit   # run only contracts tagged pre-commit
```

`contracts init` is idempotent — re-run it safely after adding contracts.

## Contract schema

Contracts live in `.contracts/*.yaml`. Each file defines one contract.

```yaml
id: C-MYPROJECT-001
description: No hardcoded secrets in source files
type: atomic
tags: [pre-commit, security]   # scalar or list; "always" bypasses --tags filter
depends_on: []                  # optional: contract IDs to run before this one
scope:
  paths: ["**/*.go", "**/*.ts"]
  exclude: ["**/*_test.go"]
checks:
  - name: no aws keys
    no_regex_in_file:
      pattern: "AKIA[0-9A-Z]{16}"
    on_fail: fail
  - name: no private key headers
    no_regex_in_file:
      pattern: "-----BEGIN (RSA |EC )?PRIVATE KEY-----"
    on_fail: escalate
    severity: high
    category: security
    what: Private key material present in source files
    verify: "grep -r 'BEGIN.*PRIVATE KEY' src/"
    affects: ["src/"]
```

### Top-level fields

| Field | Required | Values | Notes |
|---|---|---|---|
| `id` | yes | string | Unique identifier, e.g. `C-AUTH-001` |
| `description` | yes | string | Human-readable summary |
| `type` | no | `atomic` \| `detective` \| `holistic` | Display-only metadata |
| `tags` | no | string or list | Tag filter; `always` bypasses `--tags` |
| `depends_on` | no | list of IDs | Contracts to sort before this one in `brief` output |
| `scope` | no | see below | Which files are in scope |
| `skip_if` | no | see below | Skip entire contract conditionally |
| `checks` | yes | list | One or more check assertions |

### scope

```yaml
scope: global          # all files in the project (default)

scope:
  paths: ["src/**/*.go"]       # glob patterns (doublestar syntax)
  exclude: ["**/*_test.go"]    # exclude from paths match
```

When `scope` has `paths`, each check runs once per matching file and the file path
is available in the check context.

Pattern matching rules:

| Pattern | Matches |
|---|---|
| `**/*.go` | All `.go` files at any depth |
| `src/**/*.go` | `.go` files under `src/` only |
| `*.go` | All `.go` files at any depth (bare wildcard matches by basename) |
| `.gitignore` | Only the root `.gitignore` (exact path, no basename fallback) |
| `go.mod` | Only the root `go.mod` (exact path, no basename fallback) |

Bare wildcard patterns (containing `*`, `?`, or `[`) match files by basename at any
depth. Exact filenames without wildcards match only at the specified path relative to
the project root. Use `**/<name>` to explicitly match a filename at any depth.

### skip_if

Skip the entire contract (or a single check) when a condition is true:

```yaml
skip_if:
  command_not_available: docker   # skip if docker is not on PATH
  env_var_unset: CI               # skip if CI is not set
  not_in_ci: true                 # skip when not running in CI
  path_not_exists: go.mod         # skip if path doesn't exist
```

### checks

Each check has:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Identifies the check in output |
| `on_fail` | no | Action on failure (default: `fail`) |
| `skip_if` | no | Skip this check conditionally (same conditions as contract-level) |
| one check module | yes | See modules below |

#### Brief-mode fields (optional)

These fields enrich `contracts brief` output for agents. All are optional.

| Field | Notes |
|---|---|
| `severity` | `critical` \| `high` \| `medium` \| `low` \| `info`. Derived from `on_fail` if omitted. |
| `category` | `security` \| `integrity` \| `config` \| `performance` \| `network` |
| `what` | Factual observation (no interpretation). What is wrong. |
| `verify` | Read-only shell command to confirm the issue. |
| `affects` | List of paths, services, or resources affected. |

### on_fail values

| Value | Behaviour |
|---|---|
| `fail` | Exit non-zero. Default. |
| `warn` | Log warning, exit zero. |
| `require_exemption` | Fail unless an exemption file is present. |
| `escalate` | Fail + dispatch via `escalation.command` (ConspiracyOS: escalate to sysadmin). |
| `alert` | Fail + dispatch via `escalation.command` (lower severity than `escalate`). |
| `halt_agents` | ConspiracyOS: halt all agents. Not dispatched via escalation hook. |

### Check modules

Exactly one module per check.

**command** — run a shell command, assert exit code:

```yaml
command:
  run: "go vet ./..."
  exit_code: 0              # expected exit code (default: 0)
  output_matches: ""        # optional: regex the stdout must match
```

**script** — inline shell script or external script file:

```yaml
# Inline script
script:
  inline: |
    count=$(grep -r "TODO" src/ | wc -l)
    [ "$count" -lt 20 ]
  timeout: 30s

# External script file
script:
  path: ".contracts/scripts/check-db.sh"
  timeout: 60s
```

**regex_in_file** — assert a pattern matches in the file:

```yaml
regex_in_file:
  pattern: "^version:"
```

**no_regex_in_file** — assert a pattern does NOT match:

```yaml
no_regex_in_file:
  pattern: "console\\.log"
```

**path_exists** / **path_not_exists** — assert a path exists or doesn't:

```yaml
path_exists:
  path: ".github/CODEOWNERS"
  type: file          # file | directory (optional)
```

**yaml_key** / **json_key** / **toml_key** — assert a config key:

```yaml
yaml_key:
  path: ".contracts/config.yaml"
  key: "stack"
  equals: "[go]"        # optional: exact value match
  matches: "go"         # optional: regex match
  exists: true          # optional: assert key presence only
```

**env_var** / **no_env_var** — assert an env var is set or unset:

```yaml
env_var:
  name: "CI"
  equals: "true"     # optional: exact value match
  matches: "^true$"  # optional: regex match

no_env_var:
  name: "DEBUG"
```

**command_available** — assert a binary is on PATH:

```yaml
command_available:
  name: golangci-lint
```

## .contracts/config.yaml

Optional project config:

```yaml
# Minimum contracts CLI version required.
min_version: "0.2"

# Stacks activate built-in contracts for known toolchains.
# Available: go, typescript, python, rust, elixir, javascript, rails, shell, containers, mobile
stack: [go, typescript]

# Escalation: shell out to this command when any escalate or alert check fails.
# Receives a JSON payload on stdin; CONTRACTS_SEVERITY and CONTRACTS_SUMMARY env vars are set.
escalation:
  command: "curl -sf -X POST $WEBHOOK_URL -H 'Content-Type: application/json' -d @-"
```

### Escalation payload

The JSON sent to stdin of `escalation.command`:

```json
{
  "severity": "escalate",
  "summary": "2 escalate failure(s): C-SEC-001, C-SEC-002",
  "failures": [
    {
      "contract_id": "C-SEC-001",
      "contract_description": "No hardcoded secrets",
      "check_name": "no aws keys",
      "status": "fail",
      "message": "pattern matched in src/config.go",
      "file": "src/config.go",
      "on_fail": "escalate"
    }
  ]
}
```

Env vars set on the escalation command process:

| Var | Value |
|---|---|
| `CONTRACTS_SEVERITY` | `escalate` or `alert` (`escalate` beats `alert`) |
| `CONTRACTS_SUMMARY` | Human-readable summary line |

The escalation command's exit code does not affect the audit exit code.
Output from the command goes to stderr so `--json` audit output stays clean.

## System contracts

Contracts in `~/.config/contracts/` (or `$XDG_CONFIG_HOME/contracts/`) run on every
`contracts check`, regardless of the current project. Use these for machine-wide
invariants (tool versions, SSH key hygiene, etc.).

## Built-in contracts

Built-in contracts are activated by declaring a `stack` in `.contracts/config.yaml`.

### go

| Contract | Tags | Description |
|---|---|---|
| C-GO-001 | pre-push | Go modules must not have replace directives pointing to local paths |
| C-GO-002 | pre-commit | Go code must pass vet |
| C-GO-003 | pre-commit | Go code must be gofmt-clean |
| C-GO-004 | pre-push | Go tests must pass |

### typescript

| Contract | Tags | Description |
|---|---|---|
| C-TS-001 | pre-commit | TypeScript must use strict mode |
| C-TS-002 | pre-commit | No unchecked any casts in source |
| C-TS-003 | pre-commit | use client directive requires annotation |

### Process (always active)

| Contract | Tags | Description |
|---|---|---|
| C-PROC-002 | pre-push | PR description must reference a GitHub issue |
| C-PROC-003 | pre-commit | TODO comments must include an issue reference |
| C-PROC-005 | pre-commit | worktrees/ must be gitignored |
| C-PROC-006 | pre-push | tmp/ directory must not contain stale scripts |
| C-DOC-001 | pre-push | docs/ARCHITECTURE.md must exist |
| C-DOC-002 | pre-commit | Markdown files in docs/ must have a type header |

### Security (always active)

| Contract | Tags | Description |
|---|---|---|
| C-SEC-001 | pre-commit | .env files must be gitignored |
| C-SEC-002 | pre-push | Source must pass secrets scan (gitleaks or trufflehog) |
| C-SEC-003 | pre-commit | .vault_password files must be gitignored |

## CLI reference

```
contracts [command]
```

| Command | Flags | Description |
|---|---|---|
| `check` | `--tags t1,t2`<br>`--skip-tags t3`<br>`--no-builtins`<br>`--verbose`<br>`--json` | Run all matching contracts. No `--tags` runs all. Exits non-zero if any fail. |
| `brief` | `--tags t1,t2`<br>`--no-builtins` | Agent-consumable findings report. Severity-ordered, with evidence and verify steps. Always exits zero. |
| `contract list` | | List all contracts (builtins + project) with tags and source. |
| `contract check <id>` | | Run a single contract by ID (ignores tag filter). |
| `init` | | Scaffold `.contracts/` and install git hooks. Idempotent. |
| `install` | | Re-install git hooks only. Idempotent. |

### Tags

Tags are arbitrary strings. External callers (git hooks, systemd timers, agent CLI hooks)
pass `--tags` to select which contracts to run. Contracts with no tags run unconditionally
when no `--tags` filter is active.

Special tag `always`: runs regardless of any `--tags` filter.

Common conventions:

| Tag | Invoked by |
|---|---|
| `pre-commit` | git pre-commit hook |
| `pre-push` | git pre-push hook |
| `post-merge` | git post-merge hook |
| `schedule` | systemd timer / cron |
| `pre-tool` | agent CLI PreToolUse hook |
| `post-tool` | agent CLI PostToolUse hook |

## Git hooks

`contracts init` installs `pre-commit` and `pre-push` hooks that run `contracts check`
with the appropriate tag. They are idempotent — re-running `contracts init` or
`contracts install` won't overwrite custom content.

## License

MIT. See [LICENSE](LICENSE).
