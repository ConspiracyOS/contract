// src/commands/contract.ts
import yaml from "js-yaml";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { input, select } from "@inquirer/prompts";
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

export async function contractNew(): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const existingIds = new Set(contracts.map(c => c.id));

  console.log("\nagent-config contract new\n");

  const id = await input({
    message: "Contract ID (e.g. C-001):",
    validate: (v) => {
      if (!v.trim()) return "ID is required";
      if (existingIds.has(v.trim())) return `Contract "${v.trim()}" already exists`;
      return true;
    },
  });

  const description = await input({ message: "Description:" });

  const type = await select({
    message: "Type:",
    choices: [
      { name: "atomic — each file evaluated independently", value: "atomic" },
      { name: "holistic — entire project evaluated once", value: "holistic" },
    ],
  }) as "atomic" | "holistic";

  const trigger = await select({
    message: "Trigger:",
    choices: [
      { name: "commit", value: "commit" },
      { name: "pr", value: "pr" },
      { name: "merge", value: "merge" },
      { name: "schedule", value: "schedule" },
    ],
  }) as string;

  const scopeChoice = await select({
    message: "Scope:",
    choices: [
      { name: "global (contract runs once, not per file)", value: "global" },
      { name: "paths (contract runs for each matched file)", value: "paths" },
    ],
  }) as "global" | "paths";

  let scopeYaml = "scope: global";
  if (scopeChoice === "paths") {
    const paths = await input({ message: "Glob pattern(s), comma-separated (e.g. src/**/*.ts):" });
    const pathList = paths.split(",").map(p => p.trim()).filter(Boolean);
    scopeYaml = `scope:\n  paths: [${pathList.map(p => `"${p}"`).join(", ")}]`;
  }

  const checkModule = await select({
    message: "Check module:",
    choices: [
      { name: "path_exists", value: "path_exists" },
      { name: "path_not_exists", value: "path_not_exists" },
      { name: "regex_in_file", value: "regex_in_file" },
      { name: "no_regex_in_file", value: "no_regex_in_file" },
      { name: "yaml_key", value: "yaml_key" },
      { name: "json_key", value: "json_key" },
      { name: "toml_key", value: "toml_key" },
      { name: "env_var", value: "env_var" },
      { name: "no_env_var", value: "no_env_var" },
      { name: "command_available", value: "command_available" },
      { name: "command", value: "command" },
      { name: "script", value: "script" },
    ],
  }) as string;

  let checkYaml = "";
  switch (checkModule) {
    case "path_exists":
    case "path_not_exists": {
      const path = await input({ message: "Path (relative to project root):" });
      checkYaml = `    ${checkModule}:\n      path: "${path}"`;
      break;
    }
    case "regex_in_file":
    case "no_regex_in_file": {
      const pattern = await input({ message: "Regex pattern:" });
      checkYaml = `    ${checkModule}:\n      pattern: '${pattern}'`;
      break;
    }
    case "command": {
      const run = await input({ message: "Shell command to run:" });
      checkYaml = `    command:\n      run: "${run}"\n      exit_code: 0`;
      break;
    }
    case "script": {
      const path = await input({ message: "Script path (relative to project root):" });
      checkYaml = `    script:\n      path: "${path}"`;
      break;
    }
    case "command_available": {
      const name = await input({ message: "Command name (e.g. bun, gh):" });
      checkYaml = `    command_available:\n      name: "${name}"`;
      break;
    }
    default: {
      const path = await input({ message: "File path:" });
      const key = await input({ message: "Key (dot-notation):" });
      const value = await input({ message: "Expected value:" });
      checkYaml = `    ${checkModule}:\n      path: "${path}"\n      key: "${key}"\n      equals: "${value}"`;
      break;
    }
  }

  const onFail = await select({
    message: "on_fail:",
    choices: [
      { name: "fail — blocks commit/PR", value: "fail" },
      { name: "warn — shows warning but does not block", value: "warn" },
      { name: "require_exemption — fail unless @contract annotation present", value: "require_exemption" },
    ],
  }) as string;

  const checkName = await input({ message: "Check name (short description):" });

  const contractYaml = `id: ${id}
description: ${description}
type: ${type}
trigger: ${trigger}
${scopeYaml}
checks:
  - name: ${checkName}
${checkYaml}
    on_fail: ${onFail}
`;

  const contractDir = `${root}/.agent/contracts`;
  mkdirSync(contractDir, { recursive: true });
  const filePath = `${contractDir}/${id}.yaml`;
  writeFileSync(filePath, contractYaml);

  console.log(`\nContract written to .agent/contracts/${id}.yaml`);
  console.log(`  Run: agent-config contract check ${id}\n`);
}
