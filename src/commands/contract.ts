// src/commands/contract.ts
import yaml from "js-yaml";
import { existsSync, readFileSync } from "fs";
import { Glob } from "bun";
import { loadBuiltinContracts } from "../builtins/index";
import { parseContractFile } from "../engine/parser";
import { runAudit } from "../engine/audit";
import { printAuditResult } from "../engine/reporter";
import type { Contract, ContractTrigger } from "../engine/types";
import type { ProjectConfig } from "../init/config";
import type { Stack } from "../init/detector";

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(`${dir}/.agent/config.yaml`) || existsSync(`${dir}/.git`)) return dir;
    dir = dir.split("/").slice(0, -1).join("/") || "/";
  }
  return process.cwd();
}

async function loadAllContracts(projectRoot: string): Promise<Contract[]> {
  let stacks: Stack[] = [];
  const configPath = `${projectRoot}/.agent/config.yaml`;
  if (existsSync(configPath)) {
    const cfg = yaml.load(readFileSync(configPath, "utf8")) as ProjectConfig;
    stacks = cfg.stack ?? [];
  }
  const builtins = loadBuiltinContracts(stacks);

  const projectContracts: Contract[] = [];
  const contractDir = `${projectRoot}/.agent/contracts`;
  if (existsSync(contractDir)) {
    const glob = new Glob("**/*.yaml");
    for await (const file of glob.scan({ cwd: contractDir, absolute: true })) {
      try { projectContracts.push(parseContractFile(file)); } catch { /* skip invalid */ }
    }
  }
  return [...builtins, ...projectContracts];
}

function scopeSummary(scope: Contract["scope"]): string {
  if (scope === "global") return "global";
  const paths = scope.paths ?? ["**/*"];
  return paths.join(", ").slice(0, 40);
}

export async function contractList(): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const builtinIds = new Set(loadBuiltinContracts().map(c => c.id));

  console.log("\n" + "ID".padEnd(14) + "TRIGGER".padEnd(10) + "SCOPE".padEnd(42) + "SOURCE");
  console.log("-".repeat(80));
  for (const c of contracts) {
    const source = builtinIds.has(c.id) ? "builtin" : "project";
    console.log(c.id.padEnd(14) + c.trigger.padEnd(10) + scopeSummary(c.scope).padEnd(42) + source);
  }
  console.log(`\n${contracts.length} contract(s)\n`);
}

export async function contractCheck(id: string, options: { trigger?: string }): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const contract = contracts.find(c => c.id === id);
  if (!contract) {
    console.error(`Contract "${id}" not found. Run \`agent-config contract list\` to see available contracts.`);
    process.exit(1);
  }
  const trigger = (options.trigger ?? contract.trigger) as ContractTrigger;
  const result = await runAudit([contract], trigger, root);
  printAuditResult(result);
  if (result.failed > 0) process.exit(1);
}
