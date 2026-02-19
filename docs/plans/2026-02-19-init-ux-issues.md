# `init` UX Issues — Observed on real projects

**Date**: 2026-02-19
**Sources**:
- `spectre_monorepo` worktree — submodule-based monorepo (Rust, Elixir, TypeScript sub-projects)
- `spectre_gateway` — Elixir umbrella app (6 sub-apps, Phoenix web layer, minimal existing config)

---

## Design principle: agent-assisted configuration over exhaustive heuristics

Several of the issues below (stack detection, coverage paths, umbrella recognition) could be addressed by building increasingly elaborate scanners — one for submodules, one for Elixir umbrellas, one for Nx monorepos, one for Rust workspaces, and so on. This is the wrong approach.

`agent-config` is tooling *for* AI agents. Agents are a natural fit for the project discovery problem:

> unknown structure → agent explores project → valid config

The right design: `init` produces a minimal, honest scaffold with explicit placeholders where it doesn't know the answer. A companion prompt template (or a `agent-config configure` command) invites the user to run an agent session that reads the project structure and fills in the gaps — coverage paths, per-stack scope patterns, etc.

This keeps the CLI simple and makes the tool self-consistent: you use agents to configure the thing that configures agents.

Issues #1, #4, and #5 below are all instances of the same root cause. They should be resolved by this design principle rather than individual heuristics.

---

## Issue 1: Stack detection misses submodule-based monorepos

**Severity**: High → **resolved by design principle above**

The detector checks for stack signal files only at the project root. Submodule-based monorepos have no such files at root.

**Observed**: `Detected stacks: (none)` on `spectre_monorepo`.

**Fix**: Rather than scanning deeper or parsing `.gitmodules`, init should acknowledge when detection is incomplete:
```
Could not detect stacks automatically. Select manually, or run:
  agent-config configure
```
`configure` (or a documented prompt template) lets an agent explore the project and propose the correct config.

---

## Issue 2: Default project name picks up worktree directory suffix

**Severity**: Medium

`cwd.split("/").pop()` returns the current directory name. When `init` is run inside a git worktree the default becomes `spectre_monorepo-agent-test` rather than `spectre_monorepo`.

**Fix**: Read from `git remote get-url origin` and strip the `.git` suffix. Fall back to directory name only if no remote is set.

---

## Issue 3: Overwrites existing `AGENTS.md` without warning

**Severity**: High

`writeAgentInstructions()` generates a new `AGENTS.md` unconditionally. Projects with existing, curated `AGENTS.md` files lose their content silently.

**Fix**: Check for existing file before writing. If found, prompt: "AGENTS.md already exists — overwrite, append generated sections, or skip?"

---

## Issue 4: Coverage paths assume conventional layouts — most real projects don't match

**Severity**: High → **resolved by design principle above**

The hardcoded defaults (`src/**/*`, `lib/**/*`, `app/**/*`) describe a minority of real project layouts:

- `spectre_monorepo`: code at `spectre_rs/**/*`, `spectre_ui/**/*`, `spectre_infra_ex/**/*`
- `spectre_gateway`: Elixir umbrella — code at `apps/*/lib/**/*.ex`
- Rust workspaces, Nx monorepos, Rails engines, etc. all differ

When paths don't match, C-PROC04 silently fires on nothing. The user has no signal that coverage checking is disabled.

**Fix**: Init writes coverage paths as explicit TODOs and prints a clear instruction:
```yaml
coverage_paths:
  # TODO: update these to match your project layout
  # Run `agent-config configure` to auto-detect, or edit manually.
  - src/**/*
```

---

## Issue 5: Elixir umbrella / unconventional app structure not recognized

**Severity**: Medium → **resolved by design principle above**

`spectre_gateway` is an Elixir umbrella — code lives at `apps/*/lib/**/*.ex`, not `lib/**/*.ex`. Detector correctly identifies `elixir` but nothing downstream knows about the umbrella shape. Same class of problem as #4.

**Fix**: Same as #4 — defer to `configure` / agent discovery rather than building umbrella-specific heuristics.

---

## Issue 6: Existing `contracts/` directory creates naming confusion

**Severity**: Low

Some projects have a `contracts/` dir at root for their own purposes. Agent-config uses `.agent/contracts/`.

**Fix**: One-line warning during init if `contracts/` exists at root:
```
Note: found contracts/ — agent-config uses .agent/contracts/ for its contracts (separate).
```

---

## Issue 7: Re-running init silently overwrites existing config

**Severity**: Medium

If `.agent/config.yaml` already exists, `init` overwrites it without prompting.

**Fix**: Detect existing config at startup and prompt: "Config already exists — overwrite or abort?"

---

## Issue 8: Branch protection prompt fires after files are already written

**Severity**: Low

Files are written before the branch protection question is asked. A mid-flow Ctrl-C leaves files written with no rollback.

**Fix**: Move the branch protection confirm before "Installing…", or make it a separate command (`agent-config install --branch-protection`).

---

## Summary table

| # | Issue | Severity | Resolution path |
|---|-------|----------|-----------------|
| 1 | Stack detection misses submodules | High | `configure` command / agent discovery |
| 2 | Default project name includes worktree suffix | Medium | Read from git remote URL |
| 3 | Overwrites existing AGENTS.md without warning | High | Check before write, prompt |
| 4 | Coverage paths assume conventional layouts | High | `configure` command / agent discovery |
| 5 | Elixir umbrella structure not recognized | Medium | `configure` command / agent discovery |
| 6 | No warning about existing `contracts/` directory | Low | One-line warning |
| 7 | Re-running init silently overwrites config | Medium | Detect existing config, prompt |
| 8 | Branch protection prompt fires after writes | Low | Reorder or separate command |
