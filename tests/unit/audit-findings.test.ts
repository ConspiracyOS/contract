import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { runAudit } from "../../src/engine/audit";
import { parseContract } from "../../src/engine/parser";

const TMP = mkdtempSync("/tmp/audit-findings-");

beforeAll(() => {
  mkdirSync(`${TMP}/src`, { recursive: true });
  writeFileSync(`${TMP}/src/main.ts`, "const x = 1;\n");
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("AuditResult.totalFindings", () => {
  it("is 0 when no checks produce findings", async () => {
    const contract = parseContract(`
id: TF-001
description: basic check
type: atomic
trigger: commit
scope: global
checks:
  - name: file exists
    path_exists:
      path: src/main.ts
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.totalFindings).toBe(0);
  });
});
