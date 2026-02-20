// src/init/templates/agents-md.ts
import type { ProjectConfig } from "../config";
import type { Stack } from "../detector";

const STACK_CONVENTIONS: Record<Stack, string> = {
  typescript: `- Package manager: Bun. Run \`bun install\`, not npm or yarn.
- TypeScript strict mode enforced. No \`as any\` without \`@contract\` annotation.
- Frontend: prefer existing component primitives over ad-hoc design patterns.
- If you enable opinionated preset \`frontend-design\`, follow Tailwind + shadcn/ui + CSS variable theming.`,
  javascript: `- Keep JS modules small and explicit; avoid framework-implicit magic.
- Use lint + test scripts from package.json when present (\`npm run lint\`, \`npm test\`).`,
  python: `- Package manager: uv. Use \`uv run\` to execute, \`uv add\` to install.
- Virtual environment at \`.venv/\` in project root. Never activate a system venv.
- All public functions must have type annotations (\`mypy --strict\` enforced).`,
  elixir: `- Run tests with \`mix test apps/name\` — never cd into umbrella subdirectories.
- All umbrella apps must pass \`mix test\` before declaring done.
- \`@spec\` required on all public functions. Credo strict in CI.`,
  rust: `- All modules must include property-based tests (\`proptest::\` required).
- \`cargo clippy -- -D warnings\` must pass. No warnings allowed.`,
  rails: `- Follow Rails conventions. Do not invent new patterns when Rails has one.
- All queries go through ActiveRecord — no raw SQL without RFC approval.`,
  mobile: `- Package manager: Bun. TypeScript enforced.
- No hardcoded \`localhost\` — use env vars for service addresses.`,
  containers: `- Services must not bind ports to host. Use Docker networks.
- Inter-service references use service names (e.g. \`postgres:5432\`), never \`localhost\`.
- No \`latest\` image tags — pin versions.`,
  shell: `- Scripts require \`#!/usr/bin/env bash\` and \`set -euo pipefail\`.
- Keep scripts deterministic and idempotent where possible.`,
  go: `- Keep code gofmt-clean and run \`go test ./...\` before merge.
- Use \`go vet\` findings as warnings that should usually be fixed, not ignored.`,
};

export function generateAgentsMd(config: ProjectConfig): string {
  const stackSection = config.stack
    .map(s => STACK_CONVENTIONS[s] ? `### ${s}\n${STACK_CONVENTIONS[s]}` : "")
    .filter(Boolean)
    .join("\n\n");

  return `# ${config.project} — Agent Instructions

## Role

You are an implementing agent on **${config.project}**. Your job is to implement approved RFCs, maintain quality standards, and leave the codebase in a better state than you found it.

## Non-negotiable rules

- No implementation without an approved RFC in \`.agent/specs/\`
- You do not author contracts (independence guarantee). You may propose contract changes via PR, but cannot merge them.
- "Done" means: contracts pass + scenarios pass + tests pass. Not just "unit tests pass."
- All work that should be done is a GitHub issue before it becomes a branch.

## Git protocol

- Branch naming: \`feat/RFC-NNN-slug\`, \`fix/ISSUE-NNN-slug\`, \`chore/slug\`
- Commit messages reference the issue: \`feat: add auth middleware (#42)\`
- PRs reference both issue and RFC: \`Closes #42 | RFC-001\`
- Each agent gets its own worktree. Never two agents in the same directory.
- No force-pushes. No rewriting history on \`main\`.

## Contract discipline

- Run \`agent-config audit\` before pushing. Fix failures or add exemption annotations with reasons.
- Exemption format: \`// @contract:C-042:exempt:reason-here\` — reason must be non-empty.
- Never disable or bypass CI checks.

## Testing requirements

- Pre-commit: lint + typecheck (<30s). Must pass before pushing.
- CI gate: unit + integration + contract audit. Blocks merge.
- Behavioral contracts run post-merge — monitor for failures and file issues.

## RFC process

1. \`brief.md\` defines the problem and scope (owner writes).
2. \`proposal.md\` defines approach with concrete examples (agent may draft, owner approves).
3. No implementation begins until \`approval.md\` is signed.
4. \`review.md\` must contain CI evidence and scenario output before RFC is marked implemented.

## Review checklist

When performing a PR review:
- [ ] RFC approval exists and PR is within RFC scope
- [ ] Issue referenced in PR description
- [ ] \`agent-config audit\` passes (link to CI run)
- [ ] Tests added for new behaviour
- [ ] No secrets, credentials, or PII introduced
- [ ] Stack conventions followed (see below)
- [ ] Contract coverage — new files either pass applicable contracts or have exemption annotations

## Stack conventions

${stackSection || "No stack-specific conventions configured."}

## Script discipline

- \`scripts/\` — permanent scripts, reviewed like source code
- \`tmp/\` — throwaway scripts, gitignored, removed after use
- Bash scripts must start with \`#!/usr/bin/env bash\` and \`set -euo pipefail\`
`;
}
