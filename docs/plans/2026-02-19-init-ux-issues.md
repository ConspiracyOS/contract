# `init` UX Issues — Observed on spectre_monorepo

**Date**: 2026-02-19
**Source**: Manual test run of `agent-config init` on a worktree of `spectre_monorepo` (submodule-based monorepo with Rust, Elixir, TypeScript sub-projects).

---

## Issue 1: Stack detection misses submodule-based monorepos

**Severity**: High

The detector (`src/init/detector.ts`) checks for stack signal files (`Cargo.toml`, `mix.exs`, `tsconfig.json`, etc.) only at the project root. Monorepos that use git submodules have no such files at root — they live inside the submodule directories, which are empty until `git submodule update --init` is run.

**Observed**: `Detected stacks: (none)` — user must manually select all stacks.

**Fixes to consider**:
- Scan 1–2 levels deep in addition to root.
- Parse `.gitmodules` and infer stacks from submodule names (e.g. `*_rs` → rust, `*_infra_ex` → elixir, `*_ui` → typescript).
- Check submodule directories even when empty (the directory itself existing as a submodule path is a signal).

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

`writeAgentInstructions()` generates a new `AGENTS.md` unconditionally. Projects with existing, curated `AGENTS.md` files (like `spectre_monorepo`) lose their content silently.

**Fix**: Check for existing file before writing. If found, prompt: "AGENTS.md already exists — overwrite, append generated sections, or skip?"

---

## Issue 4: Default coverage paths don't match non-standard project layouts

**Severity**: Medium

The generated `coverage_paths` (`src/**/*`, `lib/**/*`, `app/**/*`) don't match projects where code lives at top-level named directories (`spectre_rs/**/*`, `spectre_ui/**/*`, `spectre_infra_ex/**/*`). C-PROC04 would never fire on any real source files.

**Fixes to consider**:
- During init, detect actual top-level source directories (non-hidden, non-config dirs with code) and use those as defaults.
- Show the proposed coverage paths and let the user edit them before writing.

---

## Issue 5: Existing `contracts/` directory creates naming confusion

**Severity**: Low

`spectre_monorepo` has a `contracts/` directory at root. `agent-config` generates `.agent/contracts/` for its YAML contracts. The two coexist silently.

**Fix**: During init, if a root-level `contracts/` directory exists, print a one-line warning:
```
Note: found contracts/ — agent-config uses .agent/contracts/ for its contracts (separate).
```
No migration tooling needed — `contracts/` is not a standard directory name and the user knows what their own directory is for.

---

## Issue 6: Re-running init silently overwrites existing config

**Severity**: Medium

If `.agent/config.yaml` already exists, `init` overwrites it without prompting. Re-running init by accident (or to update a setting) destroys the existing configuration.

**Fix**: Detect existing `.agent/config.yaml` at startup and prompt: "Config already exists — overwrite or abort?" Alternatively, provide an `agent-config config set <key> <value>` command for incremental updates.

---

## Issue 7: Branch protection prompt fires after files are already written

**Severity**: Low

The workflow writes all files first, then asks about branch protection. If the user cancels mid-flow (Ctrl-C after the files are written but before BP), there's no rollback. Minor ordering issue.

**Fix**: Move the branch protection confirm to before "Installing…", so the user approves the full plan before any writes happen. Or: make BP configuration a separate command (`agent-config install --branch-protection`).

---

## Summary table

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 1 | Stack detection misses submodules | High | `src/init/detector.ts` |
| 2 | Default project name includes worktree suffix | Medium | `src/commands/init.ts` |
| 3 | Overwrites existing AGENTS.md without warning | High | `src/init/github.ts` |
| 4 | Coverage paths don't match non-standard layouts | Medium | `src/commands/init.ts` |
| 5 | No warning about existing `contracts/` directory | Low | `src/commands/init.ts` |
| 6 | Re-running init silently overwrites config | Medium | `src/commands/init.ts` |
| 7 | Branch protection prompt after writes | Low | `src/commands/init.ts` |
