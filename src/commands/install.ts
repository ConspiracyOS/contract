// src/commands/install.ts
import { existsSync, readFileSync } from "fs";
import yaml from "js-yaml";
import { installGitHooks } from "../init/hooks";
import { writeGithubFiles } from "../init/github";
import type { ProjectConfig } from "../init/config";

export async function installCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = `${cwd}/.agent/config.yaml`;

  if (!existsSync(configPath)) {
    console.error("No .agent/config.yaml found. Run `agent-config init` first.");
    process.exit(1);
  }

  const config = yaml.load(readFileSync(configPath, "utf8")) as ProjectConfig;

  installGitHooks(cwd);
  writeGithubFiles(cwd, config);

  console.log("Hooks and CI workflows reinstalled.");
}
