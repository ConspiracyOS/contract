// src/engine/runner.ts
import type { Check, CheckResult, Contract, Finding, ModuleResult, SkipIf } from "./types";
import { spawnSync } from "child_process";
import { checkRegexInFile, checkNoRegexInFile } from "./modules/regex";
import { checkPathExists, checkPathNotExists } from "./modules/filesystem";
import { checkYamlKey, checkJsonKey, checkTomlKey } from "./modules/config";
import { checkEnvVar, checkNoEnvVar, checkCommandAvailable } from "./modules/env";
import { runCommandCheck } from "./modules/command";
import { runScriptCheck } from "./modules/script";
import { runAstGrepCheck } from "./modules/ast-grep";
import { runDepCruiserCheck } from "./modules/dependency-cruiser";
import { runImportLinterCheck } from "./modules/import-linter";
import { findExemption } from "./modules/exemption";
import { GLOBAL_SCOPE_SENTINEL } from "./scope";
import { existsSync } from "fs";

export function evaluateSkipIf(skipIf: SkipIf | undefined, projectRoot: string): boolean {
  if (!skipIf) return false;
  if (skipIf.env_var_unset && process.env[skipIf.env_var_unset] === undefined) return true;
  if (skipIf.path_not_exists && !existsSync(`${projectRoot}/${skipIf.path_not_exists}`)) return true;
  if (skipIf.not_in_ci && !process.env.CI) return true;
  if (skipIf.command_not_available) {
    const result = spawnSync("which", [skipIf.command_not_available], { encoding: "utf8" });
    if (result.status !== 0) return true;
  }
  return false;
}

async function runSingleCheck(
  check: Check,
  file: string,
  projectRoot: string
): Promise<ModuleResult> {
  const c = check as Record<string, unknown>;

  if (c["regex_in_file"]) {
    const m = c["regex_in_file"] as { pattern: string };
    const pass = file === GLOBAL_SCOPE_SENTINEL
      ? false
      : await checkRegexInFile(file, m.pattern);
    return { pass };
  }
  if (c["no_regex_in_file"]) {
    const m = c["no_regex_in_file"] as { pattern: string };
    const pass = file === GLOBAL_SCOPE_SENTINEL
      ? true
      : await checkNoRegexInFile(file, m.pattern);
    return { pass };
  }
  if (c["path_exists"]) {
    const m = c["path_exists"] as { path: string; type?: "file" | "directory" };
    return { pass: await checkPathExists(`${projectRoot}/${m.path}`, m.type) };
  }
  if (c["path_not_exists"]) {
    const m = c["path_not_exists"] as { path: string };
    return { pass: await checkPathNotExists(`${projectRoot}/${m.path}`) };
  }
  if (c["yaml_key"]) {
    const m = c["yaml_key"] as { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
    return { pass: await checkYamlKey(`${projectRoot}/${m.path}`, m.key, m) };
  }
  if (c["json_key"]) {
    const m = c["json_key"] as { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
    return { pass: await checkJsonKey(`${projectRoot}/${m.path}`, m.key, m) };
  }
  if (c["toml_key"]) {
    const m = c["toml_key"] as { path: string; key: string; equals?: string; matches?: string; exists?: boolean };
    return { pass: await checkTomlKey(`${projectRoot}/${m.path}`, m.key, m) };
  }
  if (c["env_var"]) {
    const m = c["env_var"] as { name: string; equals?: string; matches?: string };
    return { pass: await checkEnvVar(m.name, m) };
  }
  if (c["no_env_var"]) {
    const m = c["no_env_var"] as { name: string; matches?: string };
    return { pass: await checkNoEnvVar(m.name, m.matches) };
  }
  if (c["command_available"]) {
    const m = c["command_available"] as { name: string };
    return { pass: await checkCommandAvailable(m.name) };
  }
  if (c["command"]) {
    const m = c["command"] as { run: string; exit_code?: number; output_matches?: string };
    const result = await runCommandCheck(m, projectRoot);
    return { pass: result.pass, reason: result.reason };
  }
  if (c["script"]) {
    const m = c["script"] as { path: string; timeout?: string };
    const parsed = m.timeout ? parseInt(m.timeout, 10) : NaN;
    const timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 60_000;
    const result = await runScriptCheck(`${projectRoot}/${m.path}`, projectRoot, timeoutMs);
    return { pass: result.pass, reason: result.message };
  }

  if (c["ast_grep"]) {
    const m = c["ast_grep"] as { rule: string };
    return await runAstGrepCheck(m, file, projectRoot);
  }

  if (c["dependency_cruiser"]) {
    const m = c["dependency_cruiser"] as { config: string };
    return await runDepCruiserCheck(m, file, projectRoot);
  }

  if (c["import_linter"]) {
    const m = c["import_linter"] as { config?: string };
    return await runImportLinterCheck(m, projectRoot);
  }

  return { pass: false, reason: `unknown check module in: ${Object.keys(c).join(", ")}` };
}

export async function runCheck(
  contract: Contract,
  check: Check,
  file: string,
  projectRoot: string
): Promise<CheckResult> {
  if (evaluateSkipIf(check.skip_if, projectRoot)) {
    return {
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "skip",
      file,
    };
  }

  const result = await runSingleCheck(check, file, projectRoot);
  const { pass, reason } = result;
  const findings = "findings" in result ? result.findings : undefined;
  const onFail = check.on_fail ?? "fail";

  if (pass) {
    return {
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "pass",
      file,
      findings,
    };
  }

  if (onFail === "warn") {
    return {
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "warn",
      message: reason,
      file,
      findings,
    };
  }

  if (onFail === "require_exemption" && file !== GLOBAL_SCOPE_SENTINEL) {
    const exemption = await findExemption(file, contract.id);
    if (exemption) {
      return {
        contractId: contract.id,
        contractDescription: contract.description,
        checkName: check.name,
        status: "exempt",
        message: exemption.reason,
        file,
      };
    }
  }

  return {
    contractId: contract.id,
    contractDescription: contract.description,
    checkName: check.name,
    status: "fail",
    message: reason ?? "check did not pass",
    file,
    findings,
  };
}
