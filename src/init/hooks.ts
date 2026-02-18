// src/init/hooks.ts
import { mkdirSync, writeFileSync, chmodSync, existsSync } from "fs";

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
  const hooksDir = `${projectRoot}/.git/hooks`;
  if (!existsSync(`${projectRoot}/.git`)) {
    console.warn("Warning: no .git directory found — skipping hook installation");
    return;
  }

  mkdirSync(hooksDir, { recursive: true });

  const preCommit = `${hooksDir}/pre-commit`;
  writeFileSync(preCommit, PRE_COMMIT_HOOK);
  chmodSync(preCommit, 0o755);

  const prePush = `${hooksDir}/pre-push`;
  writeFileSync(prePush, PRE_PUSH_HOOK);
  chmodSync(prePush, 0o755);

  console.log("Git hooks installed (pre-commit, pre-push)");
}
