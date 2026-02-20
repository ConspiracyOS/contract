import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { printAuditResult } from "../../src/engine/reporter";
import type { AuditResult } from "../../src/engine/types";

// Capture console.log output
let output: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  output = [];
  console.log = (...args: unknown[]) => output.push(args.map(String).join(" "));
});
afterEach(() => {
  console.log = originalLog;
});

function resultWithFindings(): AuditResult {
  return {
    results: [
      {
        contractId: "C-001",
        contractDescription: "No secrets",
        checkName: "scan",
        status: "fail",
        message: "2 findings",
        findings: [
          { ruleId: "no-aws-keys", message: "AWS key detected", severity: "error", file: "src/config.ts", line: 42 },
          { ruleId: "no-tokens", message: "Token found", severity: "warning", file: "src/auth.ts", line: 7 },
        ],
      },
      {
        contractId: "C-002",
        contractDescription: "TypeScript strict",
        checkName: "tsconfig",
        status: "pass",
      },
    ],
    passed: 1,
    failed: 1,
    exempt: 0,
    skipped: 0,
    warned: 0,
    totalFindings: 2,
  };
}

describe("printAuditResult — default mode", () => {
  it("shows one line per contract without findings detail", () => {
    printAuditResult(resultWithFindings());
    const joined = output.join("\n");
    expect(joined).toContain("C-001");
    expect(joined).toContain("FAIL");
    expect(joined).not.toContain("no-aws-keys");
  });
});

describe("printAuditResult — verbose mode", () => {
  it("shows findings underneath their contract", () => {
    printAuditResult(resultWithFindings(), { verbose: true });
    const joined = output.join("\n");
    expect(joined).toContain("C-001");
    expect(joined).toContain("FAIL");
    expect(joined).toContain("no-aws-keys");
    expect(joined).toContain("src/config.ts:42");
    expect(joined).toContain("no-tokens");
    expect(joined).toContain("src/auth.ts:7");
  });

  it("does not show findings for contracts without them", () => {
    printAuditResult(resultWithFindings(), { verbose: true });
    const joined = output.join("\n");
    // C-002 has no findings, should just show the one-liner
    const c002Lines = output.filter(l => l.includes("C-002"));
    expect(c002Lines).toHaveLength(1);
  });
});
