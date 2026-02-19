# `init` UX Issues — Observed on real projects

**Date**: 2026-02-19
**Sources**:
- `spectre_monorepo` worktree — submodule-based monorepo (Rust, Elixir, TypeScript sub-projects)
- `spectre_gateway` — Elixir umbrella app (6 sub-apps, Phoenix web layer, minimal existing config)

---

## Issue 1: Stack detection misses submodule-based monorepos

**Severity**: High

The detector (`src/init/detector.ts`) checks for stack signal files (`Cargo.toml`, `mix.exs`, `tsconfig.json`, etc.) only at the project root. Monorepos that use git submodules have no such files at root — they live inside the submodule directories, which are empty until `git submodule update --init` is run.

**Observed**: `Detected stacks: (none)` on `spectre_monorepo` — user must manually select all stacks.

**Fixes to consider**:
- Scan 1–2 levels deep in addition to root.
- Parse `.gitmodules` and infer stacks from submodule names (e.g. `*_rs` → rust, `*_infra_ex` → elixir, `*_ui` → typescript).
- Check submodule directories even when empty (the directory name as a declared submodule path is itself a signal).

---

## Issue 2: Default project name picks up worktree directory suffix

**Severity**: Medium

`cwd.split("/").pop()` returns the current directory name. When `init` is run inside a git worktree (`spectre_monorepo-agent-test`), the default project name becomes `spectre_monorepo-agent-test` rather than `spectre_monorepo`.

**Fixes to consider**:
- Read the project name from the git remote URL (`git remote get-url origin`), stripping the `.git` suffix.
- Fall back to `cwd.split("/").pop()` only if no remote is available.

---

## Issue 3: Overwrites existing `AGENTS.md` without warning

**Severity**: High

`writeAgentInstructions()` generates a new `AGENTS.md` unconditionally. Projects with existing, curated `AGENTS.md` files lose their content silently.

**Fix**: Check for existing file before writing. If found, prompt: "AGENTS.md already exists — overwrite, append generated sections, or skip?"

---

## Issue 4: Coverage paths assume conventional layouts — most real projects don't match

**Severity**: High

The hardcoded default coverage paths (`src/**/*`, `lib/**/*`, `app/**/*`) assume a small set of conventional project layouts. In practice, many projects diverge:

- `spectre_monorepo`: code lives at `spectre_rs/**/*`, `spectre_ui/**/*`, `spectre_infra_ex/**/*` (submodule names as top-level dirs)
- `spectre_gateway`: Elixir umbrella — code lives at `apps/*/lib/**/*.ex`, not `lib/**/*`
- Phoenix apps, Rails engines, Rust workspaces, and Nx monorepos all have their own conventions

When coverage paths don't match, C-PROC04 silently fires on nothing. The user gets no signal that coverage checking is effectively disabled.

**This is not an edge case — it's the common case.** Any project with a non-trivial structure will have wrong coverage paths out of the box.

**Fixes to consider**:
- During init, scan the project and propose candidate coverage paths based on where actual source files live, show them to the user, and let them edit before writing.
- For known stack patterns, use better defaults: elixir → `apps/**/lib/**/*`; rust workspace → `*/src/**/*`; etc.
- At minimum, make it explicit during init that coverage paths need to be verified: "Coverage paths (edit to match your layout): ..."

---

## Issue 5: Elixir umbrella structure not recognized

**Severity**: Medium

`spectre_gateway` is an Elixir umbrella app — `mix.exs` declares `apps_path: "apps"` and all 6 sub-apps live under `apps/`. The detector correctly identifies `elixir`, but nothing downstream knows it's an umbrella:

- Contract scope paths would be written as `lib/**/*.ex` (wrong) — correct is `apps/**/lib/**/*.ex`
- `mix test` in CI works for umbrellas, but coverage thresholds and per-app scoping don't apply
- No recognition of Phoenix within the umbrella (`apps/web` has `web_web.ex` naming convention)

**Fix**: Detect umbrella pattern (presence of `apps/` with multiple `mix.exs` files, or `apps_path` in root `mix.exs`) and adjust coverage paths and contract scope suggestions accordingly.

---

## Issue 6: Existing `contracts/` directory creates naming confusion

**Severity**: Low

Some projects have a `contracts/` directory at root for their own purposes. `agent-config` generates `.agent/contracts/` for its YAML contracts. The two coexist silently.

**Fix**: During init, if a root-level `contracts/` directory exists, print a one-line warning:
```
Note: found contracts/ — agent-config uses .agent/contracts/ for its contracts (separate).
```
No migration tooling needed.

---

## Issue 7: Re-running init silently overwrites existing config

**Severity**: Medium

If `.agent/config.yaml` already exists, `init` overwrites it without prompting. Re-running init by accident destroys the existing configuration.

**Fix**: Detect existing `.agent/config.yaml` at startup and prompt: "Config already exists — overwrite or abort?" Alternatively, provide an `agent-config config set <key> <value>` command for incremental updates.

---

## Issue 8: Branch protection prompt fires after files are already written

**Severity**: Low

The workflow writes all files first, then asks about branch protection. If the user cancels mid-flow, there's no rollback.

**Fix**: Move the branch protection confirm to before "Installing…", so the user approves the full plan before any writes happen. Or make it a separate command (`agent-config install --branch-protection`).

---

## Summary table

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 1 | Stack detection misses submodules | High | `src/init/detector.ts` |
| 2 | Default project name includes worktree suffix | Medium | `src/commands/init.ts` |
| 3 | Overwrites existing AGENTS.md without warning | High | `src/init/github.ts` |
| 4 | Coverage paths assume conventional layouts | High | `src/commands/init.ts` |
| 5 | Elixir umbrella structure not recognized | Medium | `src/init/detector.ts` |
| 6 | No warning about existing `contracts/` directory | Low | `src/commands/init.ts` |
| 7 | Re-running init silently overwrites config | Medium | `src/commands/init.ts` |
| 8 | Branch protection prompt fires after writes | Low | `src/commands/init.ts` |
