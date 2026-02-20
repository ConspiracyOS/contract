// src/engine/reporter.ts
import type { AuditResult, CheckResult, Finding } from "./types";

const STATUS_LABEL: Record<string, string> = {
  pass: "PASS  ",
  fail: "FAIL  ",
  exempt: "EXEMPT",
  skip: "SKIP  ",
  warn: "WARN  ",
};

export interface ReporterOptions {
  verbose?: boolean;
}

function formatFinding(f: Finding): string {
  const loc = f.file
    ? f.line
      ? `${f.file}:${f.line}`
      : f.file
    : "";
  const sev = f.severity.padEnd(7);
  return `  ${sev}  ${loc.padEnd(30)}  ${f.message} (${f.ruleId})`;
}

export function printAuditResult(result: AuditResult, options?: ReporterOptions): void {
  console.log("\n=== agent-config audit ===\n");

  const byContract = new Map<string, CheckResult[]>();
  for (const r of result.results) {
    const existing = byContract.get(r.contractId) ?? [];
    existing.push(r);
    byContract.set(r.contractId, existing);
  }

  for (const [id, checks] of byContract) {
    const worst = checks.find(c => c.status === "fail")
      ?? checks.find(c => c.status === "warn")
      ?? checks[0]!;

    const label = STATUS_LABEL[worst.status] ?? worst.status.toUpperCase().padEnd(6);
    const desc = checks[0]!.contractDescription;

    // Collect all findings across checks for this contract
    const allFindings = checks.flatMap(c => c.findings ?? []);
    const findingCount = allFindings.length;

    const extra = findingCount > 0
      ? `  — ${findingCount} finding${findingCount !== 1 ? "s" : ""}`
      : worst.message
        ? `  — ${worst.message}`
        : "";

    console.log(`${id.padEnd(12)} ${label}  ${desc}${extra}`);

    if (options?.verbose && findingCount > 0) {
      for (const f of allFindings) {
        console.log(formatFinding(f));
      }
    }
  }

  const { passed, failed, exempt, skipped, warned } = result;
  console.log(
    `\n=== ${passed} passed, ${failed} failed, ${exempt} exempt, ${skipped} skipped, ${warned} warned ===\n`
  );
}

export function formatAuditResultJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
