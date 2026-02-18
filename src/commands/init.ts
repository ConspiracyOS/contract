// src/commands/init.ts
import { input, select, checkbox, confirm } from "@inquirer/prompts";
import { detectStacks } from "../init/detector";
import { writeAgentConfig, appendGitignore } from "../init/config";
import { writeGithubFiles, writeAgentInstructions, configureBranchProtection } from "../init/github";
import { installGitHooks } from "../init/hooks";
import type { Stack } from "../init/detector";

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const detectedStacks = await detectStacks(cwd);

  console.log("\nagent-config init\n");
  if (detectedStacks.length) {
    console.log(`Detected stacks: ${detectedStacks.join(", ")}\n`);
  }

  const projectName = await input({ message: "Project name:", default: cwd.split("/").pop() });
  const githubOrg = await input({ message: "GitHub org/user:" });
  const githubRepo = await input({ message: "GitHub repo name:", default: projectName });

  const runner = await select({
    message: "CI runner:",
    choices: [
      { name: "GitHub-hosted (ubuntu-latest)", value: "github-hosted" },
      { name: "Self-hosted", value: "self-hosted" },
    ],
  }) as "github-hosted" | "self-hosted";

  const availableStacks: Stack[] = ["typescript", "python", "elixir", "rust", "rails", "mobile", "containers"];
  const stacks = await checkbox({
    message: "Stacks (space to select):",
    choices: availableStacks.map(s => ({
      name: s,
      value: s,
      checked: detectedStacks.includes(s),
    })),
  }) as Stack[];

  const requireCoverage = await confirm({
    message: "Require contract coverage on new files? (recommended)",
    default: true,
  });

  const config = {
    project: projectName!,
    github: { org: githubOrg!, repo: githubRepo!, runner },
    stack: stacks,
    contracts: {
      audit_on: ["commit", "pr"],
      behavioral_on: ["merge"],
      require_coverage: requireCoverage,
    },
  };

  console.log("\nInstalling...\n");

  writeAgentConfig(cwd, config);
  appendGitignore(cwd);
  writeGithubFiles(cwd, config);
  writeAgentInstructions(cwd, config);
  installGitHooks(cwd);

  const configureBP = await confirm({
    message: `Configure branch protection on ${githubOrg}/${githubRepo}? (requires gh auth)`,
    default: true,
  });

  if (configureBP) {
    await configureBranchProtection(githubOrg!, githubRepo!);
  }

  if (runner === "self-hosted") {
    console.log("\nSelf-hosted runner setup:");
    console.log(`  gh api repos/${githubOrg}/${githubRepo}/actions/runners/registration-token --method POST`);
    console.log("  Then follow: https://docs.github.com/en/actions/hosting-your-own-runners\n");
  }

  console.log("Done. Next steps:");
  console.log("  1. Review AGENTS.md and customise the review checklist");
  console.log("  2. Author your first contract in .agent/contracts/");
  console.log("  3. Run: agent-config audit\n");
}
