// src/engine/audit.ts
import type { AuditResult, Contract, ContractTrigger } from "./types";
import { resolveScope } from "./scope";
import { runCheck } from "./runner";

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

export async function runAudit(
  contracts: Contract[],
  trigger: ContractTrigger,
  projectRoot: string
): Promise<AuditResult> {
  const allResults = [];
  for (const contract of contracts) {
    allResults.push(...(await auditContract(contract, trigger, projectRoot)));
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
