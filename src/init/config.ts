// src/init/config.ts
import yaml from "js-yaml";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import type { Stack } from "./detector";

export interface ProjectConfig {
  project: string;
  github: { org: string; repo: string; runner: "github-hosted" | "self-hosted" };
  stack: Stack[];
  contracts: {
    audit_on: string[];
    behavioral_on: string[];
    require_coverage: boolean;
  };
}

export function generateConfig(config: ProjectConfig): string {
  return yaml.dump(config, { lineWidth: -1 });
}

export function writeAgentConfig(projectRoot: string, config: ProjectConfig): void {
  const agentDir = `${projectRoot}/.agent`;
  mkdirSync(`${agentDir}/contracts/scripts`, { recursive: true });
  mkdirSync(`${agentDir}/specs`, { recursive: true });
  mkdirSync(`${agentDir}/scenarios`, { recursive: true });
  mkdirSync(`${projectRoot}/scripts`, { recursive: true });
  mkdirSync(`${projectRoot}/tmp`, { recursive: true });

  writeFileSync(`${agentDir}/config.yaml`, generateConfig(config));
  writeFileSync(`${agentDir}/scenarios/.gitkeep`, "");
}

export function appendGitignore(projectRoot: string): void {
  const path = `${projectRoot}/.gitignore`;
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";

  const entries = [
    "tmp/",
    "worktrees/",
    ".vault_password",
    ".vault_password.sh",
    ".agent/scenarios/results/",
  ];

  const toAdd = entries.filter(e => !existing.includes(e));
  if (toAdd.length === 0) return;

  const addition = `\n# agent-config\n${toAdd.join("\n")}\n`;
  writeFileSync(path, existing + addition);
}
