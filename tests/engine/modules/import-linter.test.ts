// tests/engine/modules/import-linter.test.ts
import { describe, it, expect, afterEach } from "bun:test";
import {
  parseImportLinterOutput,
  runImportLinterCheck,
} from "../../../src/engine/modules/import-linter";

const ALL_KEPT_OUTPUT = `
=============
Import Linter
=============

---------
Contracts
---------

Analyzed 42 files, 156 dependencies.

  my_layered_contract KEPT
  my_forbidden_contract KEPT

---
`;

const BROKEN_OUTPUT = `
=============
Import Linter
=============

---------
Contracts
---------

Analyzed 42 files, 156 dependencies.

  my_layered_contract KEPT
  my_forbidden_contract BROKEN

----------------
Broken contracts
----------------

my_forbidden_contract
---------------------

mypackage.foo is not allowed to import mypackage.bar:

  mypackage.foo:8: from mypackage import bar
  mypackage.foo:16: from mypackage.bar import something
`;

const MULTIPLE_BROKEN_OUTPUT = `
=============
Import Linter
=============

---------
Contracts
---------

Analyzed 100 files, 300 dependencies.

  layered_contract BROKEN
  forbidden_contract BROKEN

----------------
Broken contracts
----------------

layered_contract
----------------

mypackage.views is not allowed to import mypackage.models:

  mypackage.views:5: from mypackage.models import User

forbidden_contract
------------------

mypackage.api is not allowed to import mypackage.internals:

  mypackage.api:10: from mypackage.internals import secret
  mypackage.api:22: from mypackage.internals import hidden
`;

describe("parseImportLinterOutput", () => {
  it("returns empty findings when all contracts kept", () => {
    const findings = parseImportLinterOutput(ALL_KEPT_OUTPUT);
    expect(findings).toEqual([]);
  });

  it("parses broken contract with violation lines", () => {
    const findings = parseImportLinterOutput(BROKEN_OUTPUT);
    expect(findings).toHaveLength(2);

    expect(findings[0]).toEqual({
      ruleId: "my_forbidden_contract",
      message: "from mypackage import bar",
      severity: "error",
      file: "mypackage/foo.py",
      line: 8,
    });

    expect(findings[1]).toEqual({
      ruleId: "my_forbidden_contract",
      message: "from mypackage.bar import something",
      severity: "error",
      file: "mypackage/foo.py",
      line: 16,
    });
  });

  it("parses multiple broken contracts", () => {
    const findings = parseImportLinterOutput(MULTIPLE_BROKEN_OUTPUT);
    expect(findings).toHaveLength(3);

    expect(findings[0]).toEqual({
      ruleId: "layered_contract",
      message: "from mypackage.models import User",
      severity: "error",
      file: "mypackage/views.py",
      line: 5,
    });

    expect(findings[1]).toEqual({
      ruleId: "forbidden_contract",
      message: "from mypackage.internals import secret",
      severity: "error",
      file: "mypackage/api.py",
      line: 10,
    });

    expect(findings[2]).toEqual({
      ruleId: "forbidden_contract",
      message: "from mypackage.internals import hidden",
      severity: "error",
      file: "mypackage/api.py",
      line: 22,
    });
  });

  it("returns empty findings for empty output", () => {
    const findings = parseImportLinterOutput("");
    expect(findings).toEqual([]);
  });
});

describe("runImportLinterCheck", () => {
  const originalSpawnSync = Bun.spawnSync;

  afterEach(() => {
    (Bun as any).spawnSync = originalSpawnSync;
  });

  it("returns pass when exit code is 0", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(ALL_KEPT_OUTPUT),
      stderr: new Uint8Array(0),
    });

    const result = await runImportLinterCheck({}, "/project");

    expect(result.pass).toBe(true);
    expect("findings" in result && result.findings).toEqual([]);
  });

  it("returns fail with findings when exit code is non-zero", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(BROKEN_OUTPUT),
      stderr: new Uint8Array(0),
    });

    const result = await runImportLinterCheck({}, "/project");

    expect(result.pass).toBe(false);
    expect("findings" in result).toBe(true);
    if ("findings" in result) {
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].ruleId).toBe("my_forbidden_contract");
      expect(result.findings[0].file).toBe("mypackage/foo.py");
      expect(result.findings[0].line).toBe(8);
    }
  });

  it("returns fail with reason when tool not found (exitCode null)", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    const result = await runImportLinterCheck({}, "/project");

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/lint-imports|import.linter/i);
  });

  it("passes config option to command when provided", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode(ALL_KEPT_OUTPUT),
        stderr: new Uint8Array(0),
      };
    };

    await runImportLinterCheck(
      { config: ".importlinter" },
      "/my/project"
    );

    expect(capturedCmd).toContain("--config");
    expect(capturedCmd).toContain("/my/project/.importlinter");
  });

  it("does not pass config when not provided", async () => {
    let capturedCmd: string[] = [];
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      capturedCmd = cmd;
      return {
        exitCode: 0,
        stdout: new TextEncoder().encode(ALL_KEPT_OUTPUT),
        stderr: new Uint8Array(0),
      };
    };

    await runImportLinterCheck({}, "/my/project");

    expect(capturedCmd).not.toContain("--config");
  });
});
