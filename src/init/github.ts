// src/init/github.ts
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from "fs";
import type { ProjectConfig } from "./config";
import {
  generateCODEOWNERS,
  generatePRTemplate,
  generateCIWorkflow,
  generatePostMergeWorkflow,
  generateFeatureIssueTemplate,
  generateBugIssueTemplate,
} from "./templates/github";
import { generateAgentsMd } from "./templates/agents-md";

export function writeGithubFiles(projectRoot: string, config: ProjectConfig): void {
  const gh = `${projectRoot}/.github`;
  mkdirSync(`${gh}/workflows`, { recursive: true });
  mkdirSync(`${gh}/ISSUE_TEMPLATE`, { recursive: true });

  writeFileSync(`${gh}/CODEOWNERS`, generateCODEOWNERS(config));
  writeFileSync(`${gh}/PULL_REQUEST_TEMPLATE.md`, generatePRTemplate());
  writeFileSync(`${gh}/workflows/ci.yml`, generateCIWorkflow(config));
  writeFileSync(`${gh}/workflows/post-merge.yml`, generatePostMergeWorkflow(config));
  writeFileSync(`${gh}/ISSUE_TEMPLATE/feature.md`, generateFeatureIssueTemplate());
  writeFileSync(`${gh}/ISSUE_TEMPLATE/bug.md`, generateBugIssueTemplate());
}

export function writeAgentInstructions(projectRoot: string, config: ProjectConfig): void {
  const agentsMd = generateAgentsMd(config);
  writeFileSync(`${projectRoot}/AGENTS.md`, agentsMd);

  const claudeMd = `${projectRoot}/CLAUDE.md`;
  if (!existsSync(claudeMd)) {
    symlinkSync("AGENTS.md", claudeMd);
  }
}

export async function configureBranchProtection(
  org: string,
  repo: string
): Promise<void> {
  const proc = Bun.spawnSync([
    "gh", "api",
    `repos/${org}/${repo}/branches/main/protection`,
    "--method", "PUT",
    "--field", "required_status_checks[strict]=true",
    "--field", "required_status_checks[contexts][]=audit",
    "--field", "enforce_admins=false",
    "--field", "required_pull_request_reviews[required_approving_review_count]=1",
    "--field", "required_pull_request_reviews[require_code_owner_reviews]=true",
    "--field", "restrictions=null",
  ], { stderr: "pipe" });

  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr);
    console.warn(`Warning: could not configure branch protection: ${err}`);
    console.warn("Configure manually at: Settings → Branches → main → protection rules");
  }
}
