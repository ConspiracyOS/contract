# agent-config

Enforce AI agent methodology on software projects via a contract DSL. Audits your repo against typed YAML contracts and scaffolds new projects with git hooks, CI workflows, and agent instruction files.

## Installation

Download the latest binary from [Releases](https://github.com/vegardkrogh/agent-config-cli/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/vegardkrogh/agent-config-cli/releases/latest/download/agent-config-macos-arm64 \
  -o /usr/local/bin/agent-config && chmod +x /usr/local/bin/agent-config

# Linux (x64)
curl -L https://github.com/vegardkrogh/agent-config-cli/releases/latest/download/agent-config-linux-x64 \
  -o /usr/local/bin/agent-config && chmod +x /usr/local/bin/agent-config
```

Or run from source (requires [Bun](https://bun.sh)):

```bash
git clone git@github.com:vegardkrogh/agent-config-cli.git
cd agent-config-cli
bun install
bun run src/index.ts
```

## Usage

### `audit` — check contracts against the current repo

```bash
agent-config audit                  # trigger: commit (default)
agent-config audit --trigger pr     # trigger: pr
agent-config audit --trigger merge  # trigger: merge
agent-config audit --no-builtins    # skip built-in process contracts
```

Loads built-in contracts plus any `.agent/contracts/**/*.yaml` files (subdirectories supported). Exits 1 if any contract fails.

### `init` — onboard a project

```bash
agent-config init
```

Interactive prompts to configure your project. Creates:

- `.agent/config.yaml` — project configuration
- `.agent/contracts/` — directory for custom contract files
- `.github/workflows/ci.yml` — contract audit on every PR
- `.github/workflows/post-merge.yml` — behavioral contracts post-merge
- `.github/CODEOWNERS` — independence guarantee (owner must approve contract changes)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `AGENTS.md` — agent instructions (stack conventions, git protocol, RFC process)
- `CLAUDE.md` → symlink to `AGENTS.md`
- `.git/hooks/pre-commit` and `pre-push`

### `install` — re-install hooks and CI (idempotent)

```bash
agent-config install
```

Re-installs git hooks and GitHub workflow files from the existing `.agent/config.yaml`. Safe to run repeatedly.

## Contracts

Contracts are YAML files in `.agent/contracts/`. Example:

```yaml
id: C-001
description: AGENTS.md must exist at project root
type: atomic
trigger: commit
scope: global
checks:
  - name: AGENTS.md present
    path_exists:
      path: AGENTS.md
    on_fail: fail
```

### Check modules

| Module | Description |
|--------|-------------|
| `path_exists` | File or directory must exist |
| `path_not_exists` | Path must not exist |
| `regex_in_file` | File must match regex pattern |
| `no_regex_in_file` | File must not match regex pattern |
| `yaml_key` | YAML file key must equal/match/exist |
| `json_key` | JSON file key must equal/match/exist |
| `toml_key` | TOML file key must equal/match/exist |
| `env_var` | Environment variable must be set (optionally matching value) |
| `no_env_var` | Environment variable must not be set |
| `command_available` | Command must be on PATH |
| `command` | Run a shell command; check exit code and/or output |
| `script` | Run a script file; check exit code |

### Exemptions

Annotate a file to exempt it from a specific contract:

```rust
// @contract:C-003:exempt:no-stable-properties-in-this-module
```

```python
# @contract:C-003:exempt:vendor-generated-file
```

Reason must be non-empty.

### `skip_if` conditions

```yaml
skip_if:
  env_var_unset: CI          # skip when not running in CI
  path_not_exists: "tmp"     # skip when path is absent
  not_in_ci: true            # skip outside CI
```

## Built-in contracts

| ID | Trigger | Description |
|----|---------|-------------|
| C-PROC01 | pr | No secrets in git history |
| C-PROC02 | pr | PR template references issue |
| C-PROC03 | commit | No bare TODO comments without issue ref |
| C-PROC05 | commit | `worktrees/` is gitignored |
| C-PROC06 | pr | No stale files in `tmp/` |

Stack contracts are enabled based on the `stack` field in `.agent/config.yaml` (set during `agent-config init`, which auto-detects stacks from signal files: `tsconfig.json`/`package.json` → `typescript`, `mix.exs` → `elixir`, `pyproject.toml`/`requirements.txt` → `python`, `Cargo.toml` → `rust`).

Stack contracts (enabled by detected stack):

| ID | Stack | Trigger | Description |
|----|-------|---------|-------------|
| C-TS01 | TypeScript | commit | `tsc --noEmit` passes |
| C-TS02 | TypeScript | commit | No bare `as any` casts |
| C-PY01 | Python | commit | `.venv` at project root |
| C-PY02 | Python | commit | `ruff check` passes |
| C-PY03 | Python | pr | `mypy --strict` passes |
| C-EX01 | Elixir | commit | `mix format` clean |
| C-EX02 | Elixir | pr | `mix credo --strict` passes |
| C-EX04 | Elixir | pr | All umbrella apps pass `mix test` |

## Development

```bash
bun install
bun test          # run all tests
bun run build.ts  # compile binary → dist/agent-config
```
