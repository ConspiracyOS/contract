// src/init/hooks.ts
import { mkdirSync, writeFileSync, chmodSync, existsSync } from "fs";
import { spawnSync } from "child_process";

const PRE_COMMIT_HOOK = `#!/usr/bin/env bash
# agent-config pre-commit hook
set -euo pipefail

if command -v agent-config &>/dev/null; then
  agent-config audit --trigger commit
fi
`;

const PRE_PUSH_HOOK = `#!/usr/bin/env bash
# agent-config pre-push hook
set -euo pipefail

if command -v agent-config &>/dev/null; then
  agent-config audit --trigger pr
fi
`;

export function installGitHooks(projectRoot: string): void {
  if (!existsSync(`${projectRoot}/.git`)) {
    console.warn("Warning: no .git directory found — skipping hook installation");
    return;
  }

  // In a git worktree .git is a file, not a directory. Use --git-common-dir
  // to find the main .git folder where hooks live.
  const res = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: projectRoot, encoding: "utf8" });
  const gitCommonDir = res.status === 0 ? res.stdout.trim() : `${projectRoot}/.git`;
  const hooksDir = gitCommonDir.startsWith("/") ? `${gitCommonDir}/hooks` : `${projectRoot}/${gitCommonDir}/hooks`;

  mkdirSync(hooksDir, { recursive: true });

  const preCommit = `${hooksDir}/pre-commit`;
  writeFileSync(preCommit, PRE_COMMIT_HOOK);
  chmodSync(preCommit, 0o755);

  const prePush = `${hooksDir}/pre-push`;
  writeFileSync(prePush, PRE_PUSH_HOOK);
  chmodSync(prePush, 0o755);

  console.log("Git hooks installed (pre-commit, pre-push)");
}
