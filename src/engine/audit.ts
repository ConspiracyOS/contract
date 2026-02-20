// src/engine/audit.ts
import type { AuditResult, Check, Contract, ContractTrigger } from "./types";
import { resolveScope } from "./scope";
import { runCheck, evaluateSkipIf } from "./runner";

export interface CoverageOptions {
  enabled: boolean;
  paths: string[];
}

export async function auditContract(
  contract: Contract,
  trigger: ContractTrigger,
  projectRoot: string
): Promise<AuditResult["results"]> {
  if (contract.trigger !== trigger) {
    return contract.checks.map(check => ({
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "skip" as const,
      message: `trigger=${contract.trigger}, current=${trigger}`,
    }));
  }

  if (evaluateSkipIf(contract.skip_if, projectRoot)) {
    return contract.checks.map(check => ({
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "skip" as const,
      message: "contract skip_if condition met",
    }));
  }

  const files = await resolveScope(contract.scope, projectRoot);
  const results = [];

  // Checks that use script/command/env don't depend on the file parameter —
  // they run in projectRoot and produce identical results regardless of which
  // file triggered them. Run these once and reuse the result for all files.
  const FILE_INDEPENDENT_MODULES = new Set([
    "script", "command", "command_available",
    "env_var", "no_env_var",
    "path_exists", "path_not_exists",
    "import_linter",
  ]);

  function isFileIndependent(check: Check): boolean {
    const c = check as Record<string, unknown>;
    return [...FILE_INDEPENDENT_MODULES].some(m => c[m] !== undefined);
  }

  const fileIndependentChecks = contract.checks.filter(isFileIndependent);
  const fileSpecificChecks = contract.checks.filter(c => !isFileIndependent(c));

  // Run file-independent checks once (use first file as context)
  const representativeFile = files[0] ?? "__global__";
  for (const check of fileIndependentChecks) {
    results.push(await runCheck(contract, check, representativeFile, projectRoot));
  }

  // Run file-specific checks per file
  for (const file of files) {
    for (const check of fileSpecificChecks) {
      results.push(await runCheck(contract, check, file, projectRoot));
    }
  }

  return results;
}

async function checkCoverage(
  patterns: string[],
  evaluatedFiles: Set<string>,
  projectRoot: string
): Promise<AuditResult["results"]> {
  const results: AuditResult["results"] = [];
  const files = await resolveScope({ paths: patterns }, projectRoot);
  for (const file of files) {
    if (!evaluatedFiles.has(file)) {
      results.push({
        contractId: "C-PROC04",
        contractDescription: "All source files must be in at least one contract scope",
        checkName: "file has contract coverage",
        status: "warn",
        message: "no contract evaluates this file",
        file,
      });
    }
  }
  return results;
}

export async function runAudit(
  contracts: Contract[],
  trigger: ContractTrigger,
  projectRoot: string,
  coverage?: CoverageOptions
): Promise<AuditResult> {
  const allResults: AuditResult["results"] = [];
  const evaluatedFiles = new Set<string>();

  for (const contract of contracts) {
    const contractResults = await auditContract(contract, trigger, projectRoot);
    allResults.push(...contractResults);

    // Track files evaluated by contracts that matched the trigger
    if (contract.trigger === trigger) {
      const files = await resolveScope(contract.scope, projectRoot);
      for (const file of files) {
        evaluatedFiles.add(file);
      }
    }
  }

  if (coverage?.enabled && trigger === "commit") {
    const coverageResults = await checkCoverage(coverage.paths, evaluatedFiles, projectRoot);
    allResults.push(...coverageResults);
  }

  const totalFindings = allResults.reduce(
    (sum, r) => sum + (r.findings?.length ?? 0),
    0
  );

  return {
    results: allResults,
    passed: allResults.filter(r => r.status === "pass").length,
    failed: allResults.filter(r => r.status === "fail").length,
    exempt: allResults.filter(r => r.status === "exempt").length,
    skipped: allResults.filter(r => r.status === "skip").length,
    warned: allResults.filter(r => r.status === "warn").length,
    totalFindings,
  };
}
