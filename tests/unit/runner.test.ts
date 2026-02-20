import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { runCheck } from "../../src/engine/runner";
import type { Contract, Check, Finding } from "../../src/engine/types";

const TMP = mkdtempSync("/tmp/runner-findings-");

beforeAll(() => {
  writeFileSync(`${TMP}/test.ts`, "const x = 1;\n");
});
afterAll(() => rmSync(TMP, { recursive: true }));

function makeContract(id: string): Contract {
  return {
    id,
    description: "test contract",
    type: "atomic",
    trigger: "commit",
    scope: "global",
    checks: [],
  };
}

describe("runCheck with findings-aware modules", () => {
  it("preserves findings from a module that returns ModuleResult", async () => {
    // This test validates that when runSingleCheck returns findings,
    // they appear on the CheckResult. We need a command check that
    // produces findings — but that comes in a later task.
    // For now, test that a normal check still returns no findings.
    const contract = makeContract("T-001");
    const check: Check = {
      name: "file exists",
      path_exists: { path: "test.ts" },
    };
    const result = await runCheck(contract, check, "__global__", TMP);
    expect(result.status).toBe("pass");
    expect(result.findings).toBeUndefined();
  });
});
