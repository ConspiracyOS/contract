# contracts

A contract enforcement binary for any git project. Define machine-readable invariants
in YAML, run them on commit/PR/merge hooks or on a schedule, and optionally dispatch
failures to any shell command (webhook, PagerDuty, Slack, etc.).

Works standalone — no ConspiracyOS installation required.

## Quick start

```bash
go install github.com/ConspiracyOS/contracts/cmd/contracts@latest

cd your-project
contracts init        # creates .agent/contracts/ + installs git hooks
contracts audit       # run all contracts for the current trigger
```

`contracts init` is idempotent — re-run it safely after adding contracts.

## Contract schema

Contracts live in `.agent/contracts/*.yaml`. Each file defines one contract.

```yaml
id: C-MYPROJECT-001
description: No hardcoded secrets in source files
type: atomic
trigger: commit
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
```

### Top-level fields

| Field | Required | Values | Notes |
|---|---|---|---|
| `id` | yes | string | Unique identifier, e.g. `C-AUTH-001` |
| `description` | yes | string | Human-readable summary |
| `type` | no | `atomic` \| `detective` \| `holistic` | Display-only metadata |
| `trigger` | yes | `commit` \| `pr` \| `merge` \| `schedule` | When to evaluate |
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

Skip the entire contract when a condition is true:

```yaml
skip_if:
  command_available: docker    # skip if docker is not installed
```

### checks

Each check has:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Identifies the check in output |
| `on_fail` | no | Action on failure (default: `fail`) |
| `skip_if` | no | Skip this check conditionally |
| one check module | yes | See modules below |

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
  exit_code: 0
```

**script** — inline shell script:

```yaml
script:
  run: |
    count=$(grep -r "TODO" src/ | wc -l)
    [ "$count" -lt 20 ]
  exit_code: 0
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

**yaml_key** / **json_key** / **toml_key** — assert a config key has a value:

```yaml
yaml_key:
  path: ".agent/config.yaml"
  key: "stack"
  expect: "[go]"      # optional value assertion
```

**env_var** / **no_env_var** — assert an env var is set or unset:

```yaml
env_var:
  name: "CI"

no_env_var:
  name: "DEBUG"
```

**command_available** — assert a binary is on PATH:

```yaml
command_available: golangci-lint
```

**skip_if** (check-level) — skip this check when condition is true:

```yaml
skip_if:
  command_available: docker
```

## .agent/config.yaml

Optional project config at `.agent/config.yaml`:

```yaml
# Stacks activate built-in contracts for known toolchains.
# Available: go, typescript
stack: [go, typescript]

# Escalation: shell out to this command when any escalate or alert check fails.
# Receives a JSON payload on stdin; CONTRACTS_SEVERITY and CONTRACTS_SUMMARY
# are set as env vars.
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

## Built-in contracts

Built-in contracts are activated by declaring a `stack` in `.agent/config.yaml`.

| Stack | Contract | Trigger | Description |
|---|---|---|---|
| `go` | C-GO-001 | pr | Go modules must not have replace directives pointing to local paths |
| `go` | C-GO-002 | pr | go.sum must be committed |
| `typescript` | C-TS-001 | commit | No `console.log` in TypeScript source files |

Process contracts are always active (no stack required):

| Contract | Trigger | Description |
|---|---|---|
| C-PROC02 | pr | PR description must reference a GitHub issue |
| C-PROC03 | commit | Commit message must be conventional commits format |
| C-PROC05 | pr | No direct pushes to main |
| C-SEC02 | commit | No private key material in committed files |

## CLI reference

```
contracts [command]
```

| Command | Flags | Description |
|---|---|---|
| `audit` | `--trigger commit\|pr\|merge\|schedule`<br>`--no-builtins`<br>`--verbose`<br>`--json` | Run all applicable contracts. Exits non-zero if any fail. |
| `contract list` | | List all contracts (builtins + project) with source and trigger. |
| `contract check <id>` | `--trigger` | Run a single contract by ID. |
| `init` | | Scaffold `.agent/` and install git hooks. Idempotent. |
| `install` | | Re-install git hooks only. Idempotent. |

## Git hooks

`contracts init` installs `pre-commit` and `pre-push` hooks that run `contracts audit`
with the appropriate trigger. They are idempotent — re-running `contracts init` or
`contracts install` won't overwrite custom content.

## License

MIT. See [LICENSE](LICENSE).
