// tests/engine/modules/dependency-cruiser.test.ts
import { describe, it, expect, afterEach } from "bun:test";
import {
  parseDepCruiserOutput,
  runDepCruiserCheck,
} from "../../../src/engine/modules/dependency-cruiser";

describe("parseDepCruiserOutput", () => {
  it("returns empty findings when no violations", () => {
    const output = JSON.stringify({
      summary: { violations: [] },
    });
    const findings = parseDepCruiserOutput(output);
    expect(findings).toEqual([]);
  });

  it("maps violations to findings with severity mapping and cycle info", () => {
    const output = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/app.ts",
            to: "src/utils.ts",
            rule: { name: "no-circular", severity: "warn" },
            cycle: ["src/app.ts", "src/utils.ts", "src/app.ts"],
          },
          {
            type: "dependency",
            from: "src/index.ts",
            to: "src/forbidden.ts",
            rule: { name: "not-to-test", severity: "error" },
          },
        ],
      },
    });

    const findings = parseDepCruiserOutput(output);
    expect(findings).toHaveLength(2);

    // warn -> warning, cycle appended
    expect(findings[0]).toEqual({
      ruleId: "no-circular",
      message:
        "src/app.ts \u2192 src/utils.ts (circular: src/app.ts \u2192 src/utils.ts \u2192 src/app.ts)",
      severity: "warning",
      file: "src/app.ts",
    });

    // error stays error, no cycle
    expect(findings[1]).toEqual({
      ruleId: "not-to-test",
      message: "src/index.ts \u2192 src/forbidden.ts",
      severity: "error",
      file: "src/index.ts",
    });
  });

  it("filters out violations with ignore severity", () => {
    const output = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/a.ts",
            to: "src/b.ts",
            rule: { name: "ignored-rule", severity: "ignore" },
          },
          {
            type: "dependency",
            from: "src/c.ts",
            to: "src/d.ts",
            rule: { name: "real-rule", severity: "error" },
          },
        ],
      },
    });

    const findings = parseDepCruiserOutput(output);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("real-rule");
  });

  it("passes through info severity", () => {
    const output = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/a.ts",
            to: "src/b.ts",
            rule: { name: "info-rule", severity: "info" },
          },
        ],
      },
    });

    const findings = parseDepCruiserOutput(output);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
  });

  it("throws on malformed JSON", () => {
    expect(() => parseDepCruiserOutput("not json")).toThrow();
  });
});

describe("runDepCruiserCheck", () => {
  const originalSpawnSync = Bun.spawnSync;

  afterEach(() => {
    (Bun as any).spawnSync = originalSpawnSync;
  });

  it("returns pass when output has no violations", async () => {
    const cleanOutput = JSON.stringify({ summary: { violations: [] } });

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(cleanOutput),
      stderr: new Uint8Array(0),
    });

    const result = await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "__global__",
      "/project"
    );

    expect(result.pass).toBe(true);
    expect("findings" in result && result.findings).toEqual([]);
  });

  it("returns fail with findings when violations found", async () => {
    const violationOutput = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/app.ts",
            to: "src/forbidden.ts",
            rule: { name: "not-to-test", severity: "error" },
          },
        ],
      },
    });

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(violationOutput),
      stderr: new Uint8Array(0),
    });

    const result = await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "src/app.ts",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect("findings" in result).toBe(true);
    if ("findings" in result) {
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe("not-to-test");
      expect(result.findings[0].message).toBe("src/app.ts \u2192 src/forbidden.ts");
    }
  });

  it("returns fail with reason when tool not found (exitCode null)", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    const result = await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "__global__",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/depcruise|dependency-cruiser/);
  });

  it("returns fail when stdout is empty", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    const result = await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "src/app.ts",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("uses projectRoot as target when file is __global__", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode(
          JSON.stringify({ summary: { violations: [] } })
        ),
        stderr: new Uint8Array(0),
      };
    };

    await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "__global__",
      "/my/project"
    );

    expect(capturedCmd).toContain("/my/project");
    expect(capturedCmd).not.toContain("__global__");
  });

  it("uses specific file as target when file is not __global__", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode(
          JSON.stringify({ summary: { violations: [] } })
        ),
        stderr: new Uint8Array(0),
      };
    };

    await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "/my/project/src/app.ts",
      "/my/project"
    );

    expect(capturedCmd).toContain("/my/project/src/app.ts");
  });

  it("returns fail when JSON parse fails", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode("not valid json"),
      stderr: new Uint8Array(0),
    });

    const result = await runDepCruiserCheck(
      { config: ".dependency-cruiser.cjs" },
      "src/app.ts",
      "/project"
    );

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/parse/i);
  });
});
