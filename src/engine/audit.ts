// src/engine/audit.ts
import { Glob } from "bun";
import type { AuditResult, Contract, ContractTrigger } from "./types";
import { resolveScope } from "./scope";
import { runCheck } from "./runner";

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

  const files = await resolveScope(contract.scope, projectRoot);
  const results = [];

  for (const file of files) {
    for (const check of contract.checks) {
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
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: projectRoot, absolute: true })) {
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

  return {
    results: allResults,
    passed: allResults.filter(r => r.status === "pass").length,
    failed: allResults.filter(r => r.status === "fail").length,
    exempt: allResults.filter(r => r.status === "exempt").length,
    skipped: allResults.filter(r => r.status === "skip").length,
    warned: allResults.filter(r => r.status === "warn").length,
  };
}
