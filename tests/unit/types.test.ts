import { describe, it, expect } from "bun:test";
import type { Finding, CheckResult, AuditResult } from "../../src/engine/types";

describe("Finding type", () => {
  it("accepts a minimal finding", () => {
    const f: Finding = {
      ruleId: "no-eval",
      message: "eval() is dangerous",
      severity: "error",
    };
    expect(f.ruleId).toBe("no-eval");
    expect(f.file).toBeUndefined();
  });

  it("accepts a finding with full location", () => {
    const f: Finding = {
      ruleId: "no-eval",
      message: "eval() is dangerous",
      severity: "error",
      file: "src/main.ts",
      line: 42,
      column: 5,
      endLine: 42,
      endColumn: 15,
    };
    expect(f.line).toBe(42);
  });
});

describe("CheckResult with findings", () => {
  it("works without findings (backwards compat)", () => {
    const r: CheckResult = {
      contractId: "C-001",
      contractDescription: "test",
      checkName: "test check",
      status: "pass",
    };
    expect(r.findings).toBeUndefined();
  });

  it("accepts findings array", () => {
    const r: CheckResult = {
      contractId: "C-001",
      contractDescription: "test",
      checkName: "test check",
      status: "fail",
      findings: [
        { ruleId: "r1", message: "bad", severity: "error", file: "a.ts", line: 1 },
      ],
    };
    expect(r.findings).toHaveLength(1);
  });
});

describe("AuditResult with totalFindings", () => {
  it("includes totalFindings", () => {
    const r: AuditResult = {
      results: [],
      passed: 0,
      failed: 0,
      exempt: 0,
      skipped: 0,
      warned: 0,
      totalFindings: 5,
    };
    expect(r.totalFindings).toBe(5);
  });
});
