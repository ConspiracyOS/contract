// src/commands/audit.ts
import { Glob } from "bun";
import yaml from "js-yaml";
import { parseContractFile } from "../engine/parser";
import { runAudit } from "../engine/audit";
import type { CoverageOptions } from "../engine/audit";
import { printAuditResult, formatAuditResultJson } from "../engine/reporter";
import { loadBuiltinContracts } from "../builtins/index";
import type { Contract, ContractTrigger } from "../engine/types";
import type { OpinionatedPreset, ProjectConfig } from "../init/config";
import type { Stack } from "../init/detector";
import { existsSync, readFileSync } from "fs";

function findProjectRoot(cwd: string): string {
  let dir = cwd;
  while (dir !== "/") {
    if (existsSync(`${dir}/.agent/config.yaml`) || existsSync(`${dir}/.git`)) {
      return dir;
    }
    dir = dir.split("/").slice(0, -1).join("/") || "/";
  }
  console.warn(`Warning: no project root found from ${cwd} — using cwd as root`);
  return cwd;
}

async function loadProjectContracts(projectRoot: string): Promise<Contract[]> {
  const contractDir = `${projectRoot}/.agent/contracts`;
  if (!existsSync(contractDir)) return [];

  const contracts: Contract[] = [];
  const glob = new Glob("**/*.yaml");
  for await (const file of glob.scan({ cwd: contractDir, absolute: true })) {
    try {
      contracts.push(parseContractFile(file));
    } catch (e) {
      console.warn(`Warning: could not parse ${file}: ${e}`);
    }
  }
  return contracts;
}

export async function auditCommand(options: {
  trigger?: string;
  noBuiltins?: boolean;
  verbose?: boolean;
  json?: boolean;
}): Promise<void> {
  const trigger = (options.trigger ?? "commit") as ContractTrigger;
  const projectRoot = findProjectRoot(process.cwd());

  const projectContracts = await loadProjectContracts(projectRoot);

  let stacks: Stack[] = [];
  let opinionatedPresets: OpinionatedPreset[] = [];
  let coverage: CoverageOptions | undefined;
  const configPath = `${projectRoot}/.agent/config.yaml`;
  if (existsSync(configPath)) {
    const cfg = yaml.load(readFileSync(configPath, "utf8")) as ProjectConfig;
    stacks = cfg.stack ?? [];
    opinionatedPresets = cfg.opinionated?.presets ?? [];
    if (cfg.contracts?.require_coverage !== false) {
      coverage = {
        enabled: true,
        paths: cfg.contracts?.coverage_paths ?? ["src/**/*", "lib/**/*", "app/**/*"],
      };
    }
  }

  const builtins = options.noBuiltins ? [] : loadBuiltinContracts(stacks, opinionatedPresets);
  const contracts = [...builtins, ...projectContracts];

  if (contracts.length === 0) {
    console.log("No contracts found. Run `agent-config init` to set up a project.");
    process.exit(0);
  }

  const result = await runAudit(contracts, trigger, projectRoot, coverage);

  if (options.json) {
    console.log(formatAuditResultJson(result));
  } else {
    printAuditResult(result, { verbose: options.verbose });
  }

  if (result.failed > 0) process.exit(1);
}
