// src/engine/reporter.ts
import type { AuditResult } from "./types";

const STATUS_LABEL: Record<string, string> = {
  pass: "PASS  ",
  fail: "FAIL  ",
  exempt: "EXEMPT",
  skip: "SKIP  ",
  warn: "WARN  ",
};

export function printAuditResult(result: AuditResult): void {
  console.log("\n=== agent-config audit ===\n");

  const byContract = new Map<string, typeof result.results>();
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
    const extra = worst.message ? `  — ${worst.message}` : "";
    console.log(`${id.padEnd(12)} ${label}  ${desc}${extra}`);
  }

  const { passed, failed, exempt, skipped, warned } = result;
  console.log(
    `\n=== ${passed} passed, ${failed} failed, ${exempt} exempt, ${skipped} skipped, ${warned} warned ===\n`
  );
}
