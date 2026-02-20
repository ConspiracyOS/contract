// tests/engine/modules/ast-grep.test.ts
import { describe, it, expect, afterEach } from "bun:test";
import { parseAstGrepOutput, runAstGrepCheck } from "../../../src/engine/modules/ast-grep";

describe("parseAstGrepOutput", () => {
  it("returns empty findings for empty array", () => {
    const findings = parseAstGrepOutput("[]");
    expect(findings).toEqual([]);
  });

  it("maps matches to findings with 1-based lines and hint->info", () => {
    const matches = [
      {
        ruleId: "no-console",
        message: "Remove console.log",
        severity: "hint",
        file: "src/app.ts",
        range: {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 15 },
        },
      },
      {
        ruleId: "no-var",
        message: "Use let or const",
        severity: "warning",
        file: "src/utils.ts",
        range: {
          start: { line: 9, column: 2 },
          end: { line: 9, column: 20 },
        },
      },
      {
        ruleId: "critical-bug",
        message: "Dangerous pattern",
        severity: "error",
        file: "src/core.ts",
        range: {
          start: { line: 99, column: 4 },
          end: { line: 101, column: 10 },
        },
      },
    ];

    const findings = parseAstGrepOutput(JSON.stringify(matches));

    expect(findings).toHaveLength(3);

    // hint -> info
    expect(findings[0]).toEqual({
      ruleId: "no-console",
      message: "Remove console.log",
      severity: "info",
      file: "src/app.ts",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 16,
    });

    // warning stays warning
    expect(findings[1]).toEqual({
      ruleId: "no-var",
      message: "Use let or const",
      severity: "warning",
      file: "src/utils.ts",
      line: 10,
      column: 3,
      endLine: 10,
      endColumn: 21,
    });

    // error stays error
    expect(findings[2]).toEqual({
      ruleId: "critical-bug",
      message: "Dangerous pattern",
      severity: "error",
      file: "src/core.ts",
      line: 100,
      column: 5,
      endLine: 102,
      endColumn: 11,
    });
  });

  it("throws on malformed JSON", () => {
    expect(() => parseAstGrepOutput("not json")).toThrow();
  });
});

describe("runAstGrepCheck", () => {
  // Save original Bun.spawnSync so we can restore it
  const originalSpawnSync = Bun.spawnSync;

  afterEach(() => {
    // Restore original after each test
    (Bun as any).spawnSync = originalSpawnSync;
  });

  it("returns pass with empty findings when tool returns empty array", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode("[]"),
      stderr: new Uint8Array(0),
    });

    const result = await runAstGrepCheck(
      { rule: "rules/no-console.yml" },
      "__global__",
      "/project"
    );

    expect(result.pass).toBe(true);
    expect("findings" in result && result.findings).toEqual([]);
  });

  it("returns fail with findings when tool returns matches", async () => {
    const matches = [
      {
        ruleId: "no-console",
        message: "Remove console.log",
        severity: "error",
        file: "src/app.ts",
        range: {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 20 },
        },
      },
    ];

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(JSON.stringify(matches)),
      stderr: new Uint8Array(0),
    });

    const result = await runAstGrepCheck(
      { rule: "rules/no-console.yml" },
      "src/app.ts",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect("findings" in result).toBe(true);
    if ("findings" in result) {
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe("no-console");
      expect(result.findings[0].line).toBe(6); // 0-based -> 1-based
    }
  });

  it("returns fail with reason mentioning sg when tool not found", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    const result = await runAstGrepCheck(
      { rule: "rules/no-console.yml" },
      "__global__",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/sg/);
  });

  it("scans projectRoot when file is __global__", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode("[]"),
        stderr: new Uint8Array(0),
      };
    };

    await runAstGrepCheck(
      { rule: "rules/test.yml" },
      "__global__",
      "/my/project"
    );

    expect(capturedCmd).toContain("/my/project");
    expect(capturedCmd).not.toContain("__global__");
  });

  it("scans specific file when file is not __global__", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode("[]"),
        stderr: new Uint8Array(0),
      };
    };

    await runAstGrepCheck(
      { rule: "rules/test.yml" },
      "/my/project/src/app.ts",
      "/my/project"
    );

    expect(capturedCmd).toContain("/my/project/src/app.ts");
  });
});
