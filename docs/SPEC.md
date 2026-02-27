# agent-config — Specification

**Status**: Draft
**Last updated**: 2026-02-18

---

## Problem

AI agents are good at following instructions in docs. They are bad at being held to those instructions over time. CLAUDE.md and AGENTS.md get written once and then silently violated — not maliciously, but because nothing enforces them. Tests pass, the agent declares "done", and the human discovers broken invariants during demo.

The root cause is that **instruction ≠ enforcement**. agent-config closes that gap: it configures git, CI, and pre-commit hooks so that methodology is enforced by the toolchain, not by hoping the agent re-reads the docs.

---

## What It Is

A CLI tool that onboards a project with:

1. **Contracts** — human-authored invariants that CI enforces on every PR
2. **RFCs** — structured feature specifications that gate implementation work
3. **Git/GitHub setup** — branch protection, CODEOWNERS, issue templates, PR templates, worktree conventions
4. **Stack defaults** — opinionated CI workflows, linting, testing configs, and antipattern guards per language
5. **Agent instruction files** — generated AGENTS.md / CLAUDE.md with methodology baked in

The key property: once configured, an agent cannot silently ignore a contract. It either satisfies the check, adds an explicit exemption annotation with a reason, or the build fails.

---

## Core Concepts

### Contracts

A contract is a system or process invariant expressed as an automated check. Contracts are:

- **Authored by the project owner**, never by the implementing agent (independence guarantee — see below)
- **Enforced in CI** on every PR — a failing contract blocks merge
- **Permanent** — once a contract passes, it must never regress
- **Scoped** — each contract targets specific file paths, languages, or the whole project

Contracts live in `<project>/.agent/contracts/`.

#### Independence guarantee

Agents must not author contracts for their own work — the same context that writes the code cannot define what "done" means. This is enforced via CODEOWNERS:

```
# .github/CODEOWNERS
.agent/contracts/ @owner
.agent/specs/*/approval.md @owner
```

Any PR that touches a contract file or an RFC approval requires an explicit review from the project owner before merge. Agents can propose contract changes via PR but cannot merge them unilaterally.

#### Contract tiers

| Tier | Description | Expressed as |
|------|-------------|--------------|
| **Static** | Codebase inspection: regex in files, config key checks, path existence | DSL (YAML) |
| **Command** | Run a command, check exit code or output pattern | DSL (YAML, one-liner) |
| **Behavioral** | Running system, multi-step, timing-dependent | Shell script (exit 0/1) |

All three tiers are valid. The DSL covers static and command checks; behavioral contracts delegate to a shell script via `script:`. The shell script convention is: print `PASS: <description>` or `FAIL: <description>: <reason>`, exit 0/1.

#### Contract DSL

Each contract is a YAML file with an `id`, `description`, `type`, `trigger`, `scope`, and a `checks` list.

```yaml
id: C-042
description: All Rust modules must include property-based tests
type: atomic          # atomic | holistic
trigger: commit       # commit | pr | merge | schedule
scope:
  paths: ["**/*.rs"]
  exclude: ["**/build.rs", "**/*.pb.rs", "**/benches/**"]

checks:
  - name: proptest import present
    regex_in_file:
      pattern: "proptest::"
    on_fail: require_exemption   # fail | require_exemption | warn
```

```yaml
id: C-P01
description: Python .venv must be at project root
type: atomic
trigger: commit
scope: global

checks:
  - name: .venv directory at root
    path_exists:
      path: ".venv"
      type: directory

  - name: no system venv active
    no_env_var:
      name: VIRTUAL_ENV
      matches: "^/usr|^/opt"
    on_fail: warn
```

```yaml
id: C-P02
description: Docker services must not bind ports to host
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/compose*.yaml"]

checks:
  - name: no host port mapping
    no_regex_in_file:
      pattern: '"[0-9]+:[0-9]+"'
    on_fail: fail
```

```yaml
id: C-001
description: Discovery must persist entities to graph
type: holistic
trigger: merge
scope: global

checks:
  - name: discovery roundtrip
    script:
      path: ".agent/contracts/scripts/C-001-discovery-persists.sh"
      timeout: 60s
```

#### DSL module vocabulary

**Filesystem**
- `path_exists` / `path_not_exists` — file or directory, with optional `type: file|directory`
- `regex_in_file` / `no_regex_in_file` — search across scoped files

**Config inspection**
- `yaml_key` / `toml_key` / `json_key` — `path`, `key` (dot-notation), `equals|matches|exists`

**Environment**
- `env_var` / `no_env_var` — check presence, value, or pattern match
- `command_available` — `which <name>` check

**Command**
- `command` — `run: "..."`, `exit_code: 0`, optional `output_matches: "..."`

**Escape hatch**
- `script` — delegate to shell script; expects `PASS: ...` / `FAIL: ...` stdout convention, exit 0/1

**Cross-cutting fields on every check**
- `on_fail: fail | require_exemption | warn`
- `skip_if` — conditional skip: `env_var_unset: VAR`, `path_not_exists: "..."`, `not_in_ci: true`

#### Exemption annotations

When `on_fail: require_exemption`, a failing check is only acceptable if the scoped file contains an exemption annotation with a non-empty reason:

```rust
// @contract:C-042:exempt:no-stable-properties-in-this-module
```

```python
# @contract:C-P01:exempt:managed-by-devcontainer
```

Without the annotation, `agent-config audit` exits non-zero and CI fails. This forces an explicit, auditable decision. Exemptions are not available on `on_fail: fail` — those contracts must be satisfied, or the scope updated by the project owner.

### RFCs

An RFC (Request for Comments) is a structured feature proposal that gates implementation. No feature work starts without an approved RFC. RFCs live in `<project>/.agent/specs/`.

Each RFC follows the lifecycle: `draft → proposed → approved → implemented`.

```
.agent/specs/
  RFC-001-user-auth/
    brief.md          # Problem, scope, success criteria (owner writes)
    proposal.md       # Approach, acceptance criteria with concrete examples
    approval.md       # Sign-off (CODEOWNERS-protected; owner must approve)
    review.md         # Implementation evidence, CI links, scenario output
```

**Key rule (from ATDD)**: Acceptance criteria in `proposal.md` must include at least one concrete example — specific inputs → expected outputs. Abstract criteria are rejected; they must be illustrated with examples that become contracts or scenario scripts.

RFCs reference applicable contracts in `brief.md`:

```markdown
## Contract Coverage
- Applicable: C-042, C-P01
- New contracts required: C-043 (to be authored before implementation begins)
```

### Scenarios

Exploratory tests that exercise the system end-to-end to discover what works and what doesn't. Scenarios are not permanent — they're experiments. Findings graduate:

- **Bug found** → write a contract (regression guard) + RFC for the fix
- **Feature gap** → add to `GAPS.md` + scope as RFC when prioritized
- **Works** → scenario retired or kept as-is

Scenarios live in `<project>/.agent/scenarios/`. Results are gitignored.

---

## CLI

### Commands

```
agent-config init       # Onboard a project
agent-config audit      # Run all applicable contracts, report results
agent-config contract   # Manage contracts (new, list, check <id>)
agent-config spec       # Manage RFCs (new, list, status)
agent-config install    # Re-install hooks and CI workflows (idempotent)
```

### `init` flow

1. Detect repo root and existing stack (language files, package managers)
2. Prompt: project name, GitHub org/repo, stack(s)
3. Prompt: CI runner preference (GitHub-hosted or self-hosted); if self-hosted, print setup instructions and optionally configure runner registration token via `gh api`
4. Generate `.agent/config.yaml`
5. Generate `.github/CODEOWNERS` protecting `.agent/contracts/` and RFC approval files
6. Install pre-commit and pre-push hooks
7. Generate `.github/workflows/`, issue templates, PR template
8. Configure GitHub branch protection via `gh` CLI (require PR, passing CI, CODEOWNERS review)
9. Generate `AGENTS.md` with project-specific role, methodology, review checklist, and stack conventions; symlink `CLAUDE.md → AGENTS.md`
10. Print summary of what was installed and what requires manual action

### `audit` output

```
=== agent-config audit ===

C-042  PASS    All Rust modules have proptest (auto-verified)
C-P01  PASS    .venv at project root
C-P02  EXEMPT  src/dev-compose.yml — @contract:C-P02:exempt:dev-only, no external exposure
C-001  SKIP    trigger=merge, not applicable on commit

=== 2 passed, 1 exempt, 1 skipped, 0 failed ===
```

A failed contract exits non-zero, blocking CI.

---

## Project Structure (installed into target project)

```
<project>/
├── .agent/
│   ├── config.yaml           # Stack, GitHub config, contract settings
│   ├── contracts/            # Project-specific contract YAML files (owner-authored)
│   │   └── scripts/          # Shell scripts for behavioral contracts
│   ├── specs/                # RFCs (RFC-NNN-slug/)
│   └── scenarios/            # Exploratory tests (results/ gitignored)
├── .github/
│   ├── CODEOWNERS            # Protects contracts/ and RFC approvals
│   ├── workflows/
│   │   ├── ci.yml            # PR gate: lint, test, contract audit (static + command)
│   │   └── post-merge.yml    # Post-merge: behavioral contracts, slow tests, doc staleness
│   ├── ISSUE_TEMPLATE/
│   │   ├── feature.md
│   │   └── bug.md
│   └── PULL_REQUEST_TEMPLATE.md
├── scripts/                  # Permanent, shared scripts
├── tmp/                      # Temporary/throwaway scripts (gitignored)
├── AGENTS.md                 # Agent role definition (canonical)
└── CLAUDE.md                 # Symlink to AGENTS.md
```

### `.agent/config.yaml`

```yaml
project: my-project
github:
  org: my-org
  repo: my-project
  runner: self-hosted          # github-hosted | self-hosted
stack:
  - typescript
  - python
contracts:
  audit_on: [commit, pr]       # triggers for static + command contracts
  behavioral_on: [merge]       # triggers for script-based contracts
  require_coverage: true       # fail if new files in a contract's scope have no check or exemption
                               # set to false if this blocks agents too aggressively
```

---

## Stack Defaults

Each stack installs: linting config, test runner setup, CI workflow steps, built-in contracts, and antipattern guards.

### TypeScript

- Default framework: Astro + shadcn/ui; no custom Tailwind classes
- Package manager: Bun
- Strict tsconfig enforced (no implicit any, strict null checks)
- Built-in contracts:
  - `C-TS01`: `tsc --noEmit` passes (no type errors)
  - `C-TS02`: Biome or ESLint check passes
  - `C-TS03`: No `as any` casts without `@contract` annotation
- Antipattern guards (enforced via contract or lint rule):
  - `useState` / `useEffect` overuse — flag when component has >2 effects or effects with complex deps; require justification annotation
  - No unconstrained `any` in function signatures

### Python

- Package manager: `uv` with `pyproject.toml`
- `.venv` enforced at `<project_root>/.venv` (never global or in a non-standard path)
- Built-in contracts:
  - `C-PY01`: `.venv` exists at project root
  - `C-PY02`: `uv run ruff check` passes
  - `C-PY03`: `mypy --strict` passes on public modules

### Elixir

- Default framework: Phoenix LiveView + Postgres
- Credo configured for performance — slow rules disabled in pre-commit, full check in CI only
- Built-in contracts:
  - `C-EX01`: `mix format --check-formatted` passes
  - `C-EX02`: `mix credo --strict` passes (CI only, not pre-commit)
  - `C-EX03`: `mix dialyzer` passes (warning-free)
  - `C-EX04`: All umbrella apps pass `mix test` (not just the first)
- Antipattern guards:
  - `@spec` required on all public functions — enforced via Dialyzer + Credo rule

### Rails

- Default stack: Rails API or full-stack (determined at init)
- Ruby version pinned via `.ruby-version`
- Built-in contracts:
  - `C-RB01`: `bundle exec rubocop` passes
  - `C-RB02`: `bundle exec rails test` passes (or RSpec equivalent)
  - `C-RB03`: No `find_by` without `.present?` nil guard in non-test code (`require_exemption`)
- Note: Rails is recommended for teams without strong language preferences. Most opinionated framework = highest predictability for AI agents = fewer hallucinations.

### Rust

- Built-in contracts:
  - `C-RS01`: `cargo clippy -- -D warnings` passes
  - `C-RS02`: `cargo fmt --check` passes
  - `C-RS03`: All modules must include property-based tests (`proptest::`)

### Mobile (Expo / React Native)

- Package manager: Bun; TypeScript enforced
- Built-in contracts:
  - `C-MO01`: `expo-doctor` passes
  - `C-MO02`: No hardcoded `localhost` in non-test source (should use env var or service name)

### Containers

- Services must not bind ports to the host
- `init` detects whether host has traefik or caddy; generates appropriate labels
- Built-in contracts:
  - `C-CT01`: No `ports:` host binding in compose files
  - `C-CT02`: All services declare a `networks:` block
  - `C-CT03`: No `latest` image tags
- Antipattern guard: `localhost` inside container configs — flag and require annotation (should be service name, e.g. `postgres:5432` not `localhost:5432`)

### Shell scripts

Scripts are categorized by permanence:

- `./scripts/` — permanent, shared, checked in, reviewed like any other source
- `./tmp/` — throwaway scripts; gitignored; removed after use

`C-SH01`: No executable scripts outside `scripts/`, `tmp/`, or test directories without exemption.

---

## Git / GitHub Integration

### Branch model

- `main` — protected; requires PR, passing CI, CODEOWNERS review
- `feat/<slug>` — feature branches; slug should reference RFC (`feat/RFC-001-user-auth`)
- `fix/<issue-number>-<slug>` — bug fixes; must reference issue number
- `chore/<slug>` — non-functional changes

### Worktrees for agents

Each agent gets its own worktree. The dispatcher passes the absolute path.

```bash
# Create
git worktree add worktrees/feat-auth -b feat/RFC-001-user-auth

# Cleanup after merge
git worktree remove worktrees/feat-auth
git branch -d feat/RFC-001-user-auth
```

`worktrees/` is gitignored (`C-PROC05`).

### Issue and PR discipline

- Every work item is a GitHub issue before it becomes a branch
- Commit messages reference the issue: `feat: add auth middleware (#42)`
- PRs reference the issue and RFC: `Closes #42 | RFC-001`
- PRs require review before merge — AI can perform the review but must follow the generated review checklist

### PR template (generated)

```markdown
## Summary
<!-- What does this PR do? -->

## RFC
<!-- RFC-NNN or N/A with reason -->

## Issue
<!-- Closes #N -->

## Evidence
<!-- CI link, test output, scenario results -->

## Contract coverage
<!-- List applicable contracts; confirm audit passes -->

## Risk
<!-- low | medium | high — one-line justification -->
```

### Review checklist

`agent-config init` generates a project-specific review checklist in `AGENTS.md`. This checklist extends the default `/review` slash command pattern with project-specific concerns (stack conventions, applicable contracts, RFC scope). Agents performing reviews must follow this checklist — it is not optional.

The checklist must be kept current: if the project's contracts or conventions change, the checklist must be updated as part of the same PR.

---

## CI Sync vs Async Policy

The guiding principle: blocking CI is expensive for agent throughput. Block only what is necessary to gate correctness; run everything else asynchronously post-merge.

| Layer | Trigger | Blocks PR? | Agent thread? |
|-------|---------|-----------|---------------|
| Lint + typecheck | Pre-commit | Yes (local) | Blocks |
| Smoketest (<30s) | Pre-commit | Yes (local) | Blocks |
| Unit + integration tests | PR | Yes (CI) | Blocks |
| Contract audit (static + command) | PR | Yes (CI) | Blocks |
| E2e tests (fast subset) | PR | Yes (CI) | Blocks |
| Behavioral contracts (script-based) | Post-merge | No | Async |
| Slow / heavy e2e | Post-merge | No | Async |
| Doc staleness check | Post-merge | No | Async |
| Security scans | Post-merge | No | Async |

Async jobs report via GitHub commit status on `main`. A separate lightweight agent can be configured to watch for async failures and file issues automatically.

---

## Testing Practices

- **Pre-commit**: lint + typecheck + smoketest. Must complete in under 30 seconds or it will be skipped by agents under time pressure.
- **PR gate**: unit tests, integration tests, contract audit. These block merge.
- **Post-merge**: behavioral contracts, slow e2e, doc staleness. These do not block the agent's main thread. Failures create GitHub issues automatically if a watcher agent is configured.
- **E2e scope**: only a fast subset of e2e tests run on PR. The full suite runs post-merge.

"Done" means: contracts pass + scenarios pass + tests pass. Not just "unit tests pass."

---

## Agent Instruction Files

`agent-config init` generates `AGENTS.md` with the following sections:

- **Role** — what the agent is responsible for in this specific project
- **RFC process** — no implementation without an approved RFC; ATDD cycle (Discuss → Distill → Develop → Demo)
- **Contract discipline** — independence guarantee; agent proposes but does not merge contracts; exemptions require reasons
- **Git protocol** — branch naming, issue references, worktree usage, no force-pushes
- **Review checklist** — project-specific, extends `/review`; must be kept current
- **Testing requirements** — what "done" means; scenario output required in PR evidence
- **Stack conventions** — project-specific tooling, antipatterns to avoid
- **Script discipline** — `scripts/` vs `tmp/`; temp scripts removed after use
- **CI policy** — which steps block and which are async; agent does not disable or bypass CI

`CLAUDE.md` is a symlink to `AGENTS.md`.

---

## Built-in Process Contracts

Shipped with agent-config; applied to any onboarded project:

- `C-PROC01`: No secrets or credentials in git history (trufflehog or gitleaks scan)
- `C-PROC02`: PR description references an issue number
- `C-PROC03`: No bare `TODO` comments — must include issue reference: `TODO(#42): ...`
- `C-PROC04`: New source files within any contract's scope have either a passing check or an exemption annotation (configurable: `require_coverage: false` to disable)
- `C-PROC05`: `worktrees/` and `tmp/` are gitignored
- `C-PROC06`: `tmp/` directory contains no files older than 7 days (stale temp scripts)

---

## agent-config Tool Stack

- **Language**: TypeScript
- **Runtime**: Bun (`bun build --compile` → single binary)
- **GitHub integration**: `gh` CLI (prerequisite; must be installed and authenticated)
- **Distribution**: Private; GitHub repo + tagged releases (binary artifacts via GitHub Actions)

---

## Planned Work (Phase 2)

These topics are understood well enough to design but not yet specified in detail. They should each produce an RFC before implementation.

### Secrets management

`.env` files are a footgun: accidentally committed, inconsistently structured, untethered from context. The target model uses ansible-vault style encrypted secrets stored in-repo, with the vault password kept out-of-repo.

**Vault model**:

- Secrets live in an encrypted vault file committed to the repo (e.g. `.agent/vault`)
- `.vault_password` — plain text password file, gitignored; unlocks the vault locally
- `.vault_password.sh` — optional script variant for sensitive projects; reads the password from 1Password (`op`) on demand, triggering a single system popup rather than per-command prompts. Used when the vault password itself should not rest on disk.
- Agents and CI read secrets by decrypting the vault at runtime; no plaintext secrets ever touch the filesystem or env files

**Sensitivity tiers**:

| Tier | Password source | When to use |
|------|----------------|-------------|
| Standard | `.vault_password` (gitignored file) | Most projects |
| Sensitive | `.vault_password.sh` → `op read` | Projects with credentials that must not rest on disk |

**Contracts**:
- `C-SEC01`: No `.env` files committed; `.env*` in `.gitignore`
- `C-SEC02`: No secrets patterns in source (trufflehog baseline)
- `C-SEC03`: `.vault_password` and `.vault_password.sh` in `.gitignore`

`init` generates the vault file structure and adds the appropriate gitignore entries. `.env.example` is still generated for developer orientation but contains only placeholder names, not values.

### Documentation discipline

Agents generate a lot of markdown. Without structure, docs/ becomes a graveyard of stale summaries and research notes indistinguishable from living documentation.

**Document taxonomy** (enforced by contract):

| Type | Location | Purpose | Staleness policy |
|------|----------|---------|-----------------|
| Living docs | `docs/` | ARCHITECTURE.md, CONTRIBUTING.md, README.md | Updated with every relevant PR |
| Internal notes | `docs/internal/` | Research, decisions, session notes | No staleness requirement; clearly marked |
| RFC/specs | `.agent/specs/` | Feature proposals | Updated as RFC progresses |
| External docs | `docs/public/` | User-facing documentation | Treated as shipping artifact |

- Contract `C-DOC01`: `docs/ARCHITECTURE.md` exists and references the current stack
- Contract `C-DOC02`: No markdown files in `docs/` root that lack a `<!-- type: living|internal|external -->` header (optional for v1; `require_coverage: false` by default)
- Post-merge CI job checks for stale references in living docs (links to deleted files, outdated component names)

Cross-document referencing (graph-style querying of doc relations) is a future investigation — see Phase 3.

### Syntax kits

Per-stack linting and antipattern enforcement beyond what standard linters catch.

**React / TypeScript**:
- `useState` / `useEffect` overuse: flag components with >2 effects or complex dependency arrays. Require `// @pattern:complex-state:reason=...` annotation.
- Prefer server components; `use client` requires annotation.

**Elixir**:
- `@spec` on all public functions — Dialyzer enforces this but Credo rule provides earlier feedback
- Credo split: fast rules (`--only` subset) in pre-commit, full `--strict` in CI only to avoid blocking agents on slow checks

**Containers**:
- `localhost` in compose/config files targeting inter-service communication → should be service name
- Contract `C-CT04`: No `localhost` in service environment variables (regex scan with exemption path)

**Rails**:
- `find_by` without nil guard, N+1 queries (bullet gem in test env)

**Shell**:
- `#!/usr/bin/env bash` + `set -euo pipefail` required in all scripts in `scripts/`

---

## Future Work (Phase 3)

These topics need more design before they can be specified. Captured here to avoid losing context.

### Agent worklog

Agents completing a work cycle write a structured entry to `.agent/worklog/YYYY-MM.md`:

```
## 2026-02-18 | feat/RFC-001-user-auth | agent: claude-sonnet
- Implemented JWT middleware
- Blocked 45min: Dialyzer failures due to missing @spec on AuthPlug
- Resolution: added @spec, C-EX03 now passes
- Evidence: CI #123 green
```

The worklog surface patterns that agents cannot detect within a single context window — e.g. repeatedly disabling a QA step to pass CI, or repeated blocks on the same contract. Periodic review of the worklog (human or senior agent) can identify systemic issues.

### Code entropy detection

The most persistent AI agent failure mode: code duplication, scope mixing, and expanding responsibilities without critical review.

Common patterns observed:
- **Module duplication**: `api/auth/api_client.py` competing with `api/auth_client.py` — agent creates a second module without noticing the first
- **Layer mixing**: database queries scattered across controllers, services, and background jobs rather than centralised in a data layer
- **Scope creep**: agent accepts new feature requests without considering whether they belong in this repo/module at all
- **Low DRY**: same logic implemented explicitly in N files instead of extracted once

Potential mitigations (needs tooling design):
- Pre-commit check: detect files with similar names in sibling directories (fuzzy match on path segments)
- RFC scope review: AGENTS.md instructs agent to search for existing implementations before creating new ones
- Architectural boundary contracts: declare module boundaries in config; flag cross-boundary imports

### Author differentiation

Goal: distinguish agent-authored commits from human commits for enforcement purposes (e.g. "must be reviewed by a different agent than the author", "cannot merge without human approval for auth changes").

Blocked by: agents running under the same GitHub user account as the human. Creating a separate GitHub account for agents incurs seat costs and additional management overhead. This is largely a **non-goal** for now — social conventions in AGENTS.md are the primary mechanism. Revisit if GitHub introduces native bot identity features or if the seat cost becomes acceptable.

### MCP tools and plugin overlap

AI coding tools often ship with plugins or MCP servers that overlap with what agent-config does (PR management, code review, feature workflow).

Before installing agent-config into a project, audit which plugins or tools are active and document which agent-config features they replace or conflict with. Do not install competing patterns.

### Cross-document referencing

Graph-style querying of documentation relationships — finding all docs that reference RFC-001, all contracts that apply to a given file, all open issues that relate to a given module. Obsidian-style backlinks or a lightweight index file. Deferred until documentation discipline (Phase 2) is established and the doc taxonomy is stable enough to index.

---

## Non-Goals

- **GitLab / other CI platforms**: GitHub Actions only for v1.
- **npm publishing**: Private distribution via GitHub releases only.
- **spectre_rs integration**: Deferred until spectre_rs has a stable CLI interface and release binaries. mod_fs and mod_net are individually ready; the distribution and interface stability are not.
- **Enforcing contract authorship by git identity**: Not achievable without separate agent GitHub accounts. CODEOWNERS is the practical enforcement mechanism.
