// tests/integration/audit.test.ts
// End-to-end: build a real temp project tree and run the audit engine against it.
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "fs";
import { runAudit } from "../../src/engine/audit";
import { parseContract } from "../../src/engine/parser";

const TMP = mkdtempSync("/tmp/agent-config-integration-");

beforeAll(() => {
  // Minimal project tree
  mkdirSync(`${TMP}/src`, { recursive: true });
  writeFileSync(`${TMP}/AGENTS.md`, "# Agents\n");
  writeFileSync(`${TMP}/src/main.ts`, "const x = 1;\n");
  writeFileSync(`${TMP}/.gitignore`, "node_modules\nworktrees/\n");
  writeFileSync(`${TMP}/config.json`, JSON.stringify({ env: "production" }));
  writeFileSync(`${TMP}/settings.yaml`, "runner: self-hosted\n");
  writeFileSync(`${TMP}/settings.toml`, `[server]\nport = "8080"\n`);
});

afterAll(() => rmSync(TMP, { recursive: true }));

describe("runAudit — integration", () => {
  it("passes a path_exists check when the file is present", async () => {
    const contract = parseContract(`
id: INT-001
description: AGENTS.md must exist
type: atomic
trigger: commit
scope: global
checks:
  - name: AGENTS.md present
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });

  it("fails a path_exists check when the file is absent", async () => {
    const contract = parseContract(`
id: INT-002
description: missing-file.txt must exist
type: atomic
trigger: commit
scope: global
checks:
  - name: missing file
    path_exists:
      path: missing-file.txt
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });

  it("passes a regex_in_file check when pattern matches", async () => {
    const contract = parseContract(`
id: INT-003
description: src files must not use eval
type: atomic
trigger: commit
scope:
  paths:
    - src/**/*.ts
checks:
  - name: no eval
    no_regex_in_file:
      pattern: "\\beval\\b"
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
  });

  it("passes a json_key check on a real JSON file", async () => {
    const contract = parseContract(`
id: INT-004
description: config.json env must be production
type: atomic
trigger: commit
scope: global
checks:
  - name: env is production
    json_key:
      path: config.json
      key: env
      equals: production
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });

  it("passes a yaml_key check on a real YAML file", async () => {
    const contract = parseContract(`
id: INT-005
description: settings.yaml runner must be self-hosted
type: atomic
trigger: commit
scope: global
checks:
  - name: runner is self-hosted
    yaml_key:
      path: settings.yaml
      key: runner
      equals: self-hosted
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });

  it("passes a toml_key check on a real TOML file", async () => {
    const contract = parseContract(`
id: INT-006
description: settings.toml server.port must be 8080
type: atomic
trigger: commit
scope: global
checks:
  - name: port is 8080
    toml_key:
      path: settings.toml
      key: server.port
      equals: "8080"
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });

  it("skips contracts with non-matching trigger", async () => {
    const contract = parseContract(`
id: INT-007
description: pr-only check
type: atomic
trigger: pr
scope: global
checks:
  - name: always fails
    path_exists:
      path: nonexistent
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("runs multiple contracts and aggregates pass/fail correctly", async () => {
    const passing = parseContract(`
id: INT-008a
description: AGENTS.md exists
type: atomic
trigger: commit
scope: global
checks:
  - name: exists
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const failing = parseContract(`
id: INT-008b
description: ghost file must exist
type: atomic
trigger: commit
scope: global
checks:
  - name: missing
    path_exists:
      path: ghost.txt
    on_fail: fail
`);
    const result = await runAudit([passing, failing], "commit", TMP);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe("C-PROC04 coverage check", () => {
  it("warns on source files not covered by any contract", async () => {
    // TMP already has src/main.ts; no contract covers src/**/*.ts
    const result = await runAudit(
      [],  // no contracts
      "commit",
      TMP,
      { enabled: true, paths: ["src/**/*"] }
    );
    expect(result.warned).toBeGreaterThan(0);
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(true);
  });

  it("does not warn when files are covered by a contract", async () => {
    const contract = parseContract(`
id: INT-COVER
description: cover src files
type: atomic
trigger: commit
scope:
  paths:
    - src/**/*
checks:
  - name: any file
    path_exists:
      path: src
    on_fail: warn
`);
    const result = await runAudit(
      [contract],
      "commit",
      TMP,
      { enabled: true, paths: ["src/**/*"] }
    );
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });

  it("does not fire when enabled is false", async () => {
    const result = await runAudit([], "commit", TMP, { enabled: false, paths: ["src/**/*"] });
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });

  it("does not fire on non-commit triggers", async () => {
    const result = await runAudit([], "pr", TMP, { enabled: true, paths: ["src/**/*"] });
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });
});

describe("C-SEC02 secrets scan contract", () => {
  it("parses and runs the C-SEC02 builtin contract", async () => {
    const { PROC_CONTRACTS } = await import("../../src/builtins/proc");
    const sec02 = PROC_CONTRACTS.find(c => c.includes("C-SEC02"));
    expect(sec02).toBeDefined();
    const contract = parseContract(sec02!);
    expect(contract.id).toBe("C-SEC02");
    expect(contract.checks[0]!.on_fail).toBe("warn");
  });
});

describe("C-TS03 use client annotation", () => {
  it("fails when use client has no annotation comment", async () => {
    writeFileSync(`${TMP}/src/ClientComp.tsx`, '"use client";\nexport default function Foo() { return null; }\n');
    const contract = parseContract(`
id: C-TS03
description: use client directive requires annotation
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx"]
  exclude: ["**/*.test.tsx"]
checks:
  - name: use client requires annotation
    no_regex_in_file:
      pattern: '"use client"(?!.*@pattern:client-component)'
    on_fail: require_exemption
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.failed).toBe(1);
  });

  it("passes when use client has annotation", async () => {
    writeFileSync(
      `${TMP}/src/AnnotatedClient.tsx`,
      '"use client"; // @pattern:client-component:reason=form-state\nexport default function Bar() { return null; }\n',
    );
    const contract = parseContract(`
id: C-TS03
description: use client directive requires annotation
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx"]
  exclude: ["**/*.test.tsx"]
checks:
  - name: use client requires annotation
    no_regex_in_file:
      pattern: '"use client"(?!.*@pattern:client-component)'
    on_fail: require_exemption
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.results.filter(r => r.file?.includes("AnnotatedClient")).every(r => r.status === "pass")).toBe(true);
  });

  it("parses C-TS03 from builtins", async () => {
    const { TS_CONTRACTS } = await import("../../src/stacks/typescript");
    const ts03 = TS_CONTRACTS.find(c => c.includes("C-TS03"));
    expect(ts03).toBeDefined();
    const contract = parseContract(ts03!);
    expect(contract.id).toBe("C-TS03");
  });
});

describe("C-EX03 @spec enforcement", () => {
  it("parses C-EX03 from builtins", async () => {
    const { EX_CONTRACTS } = await import("../../src/stacks/elixir");
    const ex03 = EX_CONTRACTS.find(c => c.includes("C-EX03"));
    expect(ex03).toBeDefined();
    const contract = parseContract(ex03!);
    expect(contract.id).toBe("C-EX03");
    expect(contract.checks[0]!.skip_if).toEqual({ command_not_available: "mix" });
  });
});

describe("C-RB04 bullet gem", () => {
  it("parses C-RB04 from builtins", async () => {
    const { RB_CONTRACTS } = await import("../../src/stacks/rails");
    const rb04 = RB_CONTRACTS.find(c => c.includes("C-RB04"));
    expect(rb04).toBeDefined();
    const contract = parseContract(rb04!);
    expect(contract.id).toBe("C-RB04");
  });

  it("warns when Gemfile exists but lacks bullet", async () => {
    writeFileSync(`${TMP}/Gemfile`, 'gem "rails"\ngem "pg"\n');
    const { RB_CONTRACTS } = await import("../../src/stacks/rails");
    const contract = parseContract(RB_CONTRACTS.find(c => c.includes("C-RB04"))!);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.warned).toBe(1);
  });
});

describe("Shell stack contracts", () => {
  beforeAll(() => {
    mkdirSync(`${TMP}/scripts`, { recursive: true });
    writeFileSync(`${TMP}/scripts/good.sh`, '#!/usr/bin/env bash\nset -euo pipefail\necho "hello"\n');
    writeFileSync(`${TMP}/scripts/bad-shebang.sh`, '#!/bin/sh\necho "hello"\n');
    writeFileSync(`${TMP}/scripts/bad-strict.sh`, '#!/usr/bin/env bash\necho "hello"\n');
  });

  it("parses C-SH01 and C-SH02 from builtins", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    expect(SH_CONTRACTS).toHaveLength(2);
    const sh01 = parseContract(SH_CONTRACTS[0]!);
    const sh02 = parseContract(SH_CONTRACTS[1]!);
    expect(sh01.id).toBe("C-SH01");
    expect(sh02.id).toBe("C-SH02");
  });

  it("C-SH01 passes for bash shebang, fails for sh shebang", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    const contract = parseContract(SH_CONTRACTS[0]!);
    const result = await runAudit([contract], "commit", TMP);
    const passes = result.results.filter(r => r.status === "pass");
    const fails = result.results.filter(r => r.status === "fail");
    expect(passes.length).toBe(2);
    expect(fails.length).toBe(1);
  });

  it("C-SH02 passes for strict mode, fails without it", async () => {
    const { SH_CONTRACTS } = await import("../../src/stacks/shell");
    const contract = parseContract(SH_CONTRACTS[1]!);
    const result = await runAudit([contract], "commit", TMP);
    const passes = result.results.filter(r => r.status === "pass");
    const fails = result.results.filter(r => r.status === "fail");
    expect(passes.length).toBe(1);
    expect(fails.length).toBe(2);
  });
});

describe("Go stack contracts", () => {
  it("parses C-GO01/C-GO02/C-GO03 from builtins", async () => {
    const { GO_CONTRACTS } = await import("../../src/stacks/go");
    expect(GO_CONTRACTS).toHaveLength(3);
    const go01 = parseContract(GO_CONTRACTS[0]!);
    const go02 = parseContract(GO_CONTRACTS[1]!);
    const go03 = parseContract(GO_CONTRACTS[2]!);
    expect(go01.id).toBe("C-GO01");
    expect(go02.id).toBe("C-GO02");
    expect(go03.id).toBe("C-GO03");
  });
});

describe("JavaScript stack contracts", () => {
  it("parses C-JS01/C-JS02/C-JS03 from builtins", async () => {
    const { JS_CONTRACTS } = await import("../../src/stacks/javascript");
    expect(JS_CONTRACTS).toHaveLength(3);
    const js01 = parseContract(JS_CONTRACTS[0]!);
    const js02 = parseContract(JS_CONTRACTS[1]!);
    const js03 = parseContract(JS_CONTRACTS[2]!);
    expect(js01.id).toBe("C-JS01");
    expect(js02.id).toBe("C-JS02");
    expect(js03.id).toBe("C-JS03");
  });
});

describe("Opinionated frontend-design preset", () => {
  it("does not load opinionated contracts by default", async () => {
    const { loadBuiltinContracts } = await import("../../src/builtins/index");
    const contracts = loadBuiltinContracts(["typescript"]);
    expect(contracts.some(c => c.id === "C-FD01")).toBe(false);
    expect(contracts.some(c => c.id === "C-FD02")).toBe(false);
    expect(contracts.some(c => c.id === "C-FD03")).toBe(false);
  });

  it("loads frontend-design contracts when preset is enabled", async () => {
    const { loadBuiltinContracts } = await import("../../src/builtins/index");
    const contracts = loadBuiltinContracts(["typescript"], ["frontend-design"]);
    expect(contracts.some(c => c.id === "C-FD01")).toBe(true);
    expect(contracts.some(c => c.id === "C-FD02")).toBe(true);
    expect(contracts.some(c => c.id === "C-FD03")).toBe(true);
  });
});

describe("Findings pipeline", () => {
  it("CheckResult carries findings through the full audit pipeline", async () => {
    const contract = parseContract(`
id: INT-FIND-001
description: basic check with no findings
type: atomic
trigger: commit
scope: global
checks:
  - name: file check
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const result = await runAudit([contract], "commit", TMP);
    expect(result.totalFindings).toBe(0);
    expect(result.results[0]!.findings).toBeUndefined();
  });

  it("AuditResult.totalFindings aggregates correctly across contracts", async () => {
    const c1 = parseContract(`
id: INT-FIND-002a
description: first contract
type: atomic
trigger: commit
scope: global
checks:
  - name: check a
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const c2 = parseContract(`
id: INT-FIND-002b
description: second contract
type: atomic
trigger: commit
scope: global
checks:
  - name: check b
    path_exists:
      path: AGENTS.md
    on_fail: fail
`);
    const result = await runAudit([c1, c2], "commit", TMP);
    expect(result.totalFindings).toBe(0);
    expect(typeof result.totalFindings).toBe("number");
  });
});

describe("ast_grep integration", () => {
  const originalSpawnSync = Bun.spawnSync;

  it("parses ast_grep contract YAML and flows through the audit pipeline", async () => {
    const contract = parseContract(`
id: INT-AST-001
description: no console.log via ast-grep
type: atomic
trigger: commit
scope: global
checks:
  - name: no console.log
    ast_grep:
      rule: rules/no-console.yml
    on_fail: warn
`);

    expect(contract.id).toBe("INT-AST-001");
    expect(contract.checks[0]!.name).toBe("no console.log");
    expect((contract.checks[0] as any).ast_grep).toEqual({ rule: "rules/no-console.yml" });
  });

  it("produces warn result with findings when ast-grep returns matches", async () => {
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
      {
        ruleId: "no-console",
        message: "Remove console.log",
        severity: "warning",
        file: "src/utils.ts",
        range: {
          start: { line: 12, column: 4 },
          end: { line: 12, column: 24 },
        },
      },
    ];

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(JSON.stringify(matches)),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-AST-002
description: no console.log via ast-grep
type: atomic
trigger: commit
scope: global
checks:
  - name: no console.log
    ast_grep:
      rule: rules/no-console.yml
    on_fail: warn
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.warned).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(2);

      const checkResult = result.results[0]!;
      expect(checkResult.status).toBe("warn");
      expect(checkResult.findings).toBeDefined();
      expect(checkResult.findings!).toHaveLength(2);
      expect(checkResult.findings![0].ruleId).toBe("no-console");
      expect(checkResult.findings![0].line).toBe(6); // 0-based -> 1-based
      expect(checkResult.findings![1].line).toBe(13);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("produces fail result with findings when on_fail is fail", async () => {
    const matches = [
      {
        ruleId: "no-var",
        message: "Use let or const",
        severity: "error",
        file: "src/main.ts",
        range: {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 10 },
        },
      },
    ];

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(JSON.stringify(matches)),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-AST-003
description: no var via ast-grep
type: atomic
trigger: commit
scope: global
checks:
  - name: no var declarations
    ast_grep:
      rule: rules/no-var.yml
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.totalFindings).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
      expect(result.results[0]!.findings![0].ruleId).toBe("no-var");
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("passes when ast-grep returns no matches", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode("[]"),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-AST-004
description: clean codebase
type: atomic
trigger: commit
scope: global
checks:
  - name: no issues
    ast_grep:
      rule: rules/check.yml
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(0);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("fails gracefully when sg tool is not found", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-AST-005
description: tool not found test
type: atomic
trigger: commit
scope: global
checks:
  - name: sg not installed
    ast_grep:
      rule: rules/check.yml
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
      expect(result.results[0]!.message).toMatch(/sg/);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });
});

describe("dependency_cruiser integration", () => {
  const originalSpawnSync = Bun.spawnSync;

  it("parses dependency_cruiser contract YAML and flows through the audit pipeline", async () => {
    const contract = parseContract(`
id: INT-DC-001
description: no circular dependencies
type: atomic
trigger: commit
scope: global
checks:
  - name: no circular deps
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: warn
`);

    expect(contract.id).toBe("INT-DC-001");
    expect(contract.checks[0]!.name).toBe("no circular deps");
    expect((contract.checks[0] as any).dependency_cruiser).toEqual({ config: ".dependency-cruiser.cjs" });
  });

  it("produces warn result with findings when violations are found", async () => {
    const dcOutput = JSON.stringify({
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

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(dcOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-DC-002
description: dependency rules
type: atomic
trigger: commit
scope: global
checks:
  - name: dep cruiser rules
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: warn
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.warned).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(2);

      const checkResult = result.results[0]!;
      expect(checkResult.status).toBe("warn");
      expect(checkResult.findings).toBeDefined();
      expect(checkResult.findings!).toHaveLength(2);
      expect(checkResult.findings![0].ruleId).toBe("no-circular");
      expect(checkResult.findings![0].severity).toBe("warning");
      expect(checkResult.findings![1].ruleId).toBe("not-to-test");
      expect(checkResult.findings![1].severity).toBe("error");
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("produces fail result with findings when on_fail is fail", async () => {
    const dcOutput = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/core.ts",
            to: "src/test-helper.ts",
            rule: { name: "not-to-test", severity: "error" },
          },
        ],
      },
    });

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(dcOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-DC-003
description: strict dependency rules
type: atomic
trigger: commit
scope: global
checks:
  - name: no test imports in prod
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.totalFindings).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("passes when no violations are found", async () => {
    const dcOutput = JSON.stringify({ summary: { violations: [] } });

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(dcOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-DC-004
description: clean dependencies
type: atomic
trigger: commit
scope: global
checks:
  - name: all clean
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(0);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("fails gracefully when depcruise tool is not found", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-DC-005
description: tool not found test
type: atomic
trigger: commit
scope: global
checks:
  - name: depcruise not installed
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
      expect(result.results[0]!.message).toMatch(/depcruise|dependency-cruiser/);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });
});

describe("import_linter integration", () => {
  const originalSpawnSync = Bun.spawnSync;

  it("parses import_linter contract YAML and flows through the audit pipeline", async () => {
    const contract = parseContract(`
id: INT-IL-001
description: enforce import boundaries
type: atomic
trigger: commit
scope: global
checks:
  - name: import contracts
    import_linter:
      config: .importlinter
    on_fail: warn
`);

    expect(contract.id).toBe("INT-IL-001");
    expect(contract.checks[0]!.name).toBe("import contracts");
    expect((contract.checks[0] as any).import_linter).toEqual({ config: ".importlinter" });
  });

  it("parses import_linter contract without config option", async () => {
    const contract = parseContract(`
id: INT-IL-001b
description: enforce import boundaries (default config)
type: atomic
trigger: commit
scope: global
checks:
  - name: import contracts
    import_linter: {}
    on_fail: warn
`);

    expect(contract.id).toBe("INT-IL-001b");
    expect((contract.checks[0] as any).import_linter).toEqual({});
  });

  it("produces warn result with findings when broken contracts are found", async () => {
    const brokenOutput = `
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

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(brokenOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-IL-002
description: import boundaries
type: atomic
trigger: commit
scope: global
checks:
  - name: no forbidden imports
    import_linter:
      config: .importlinter
    on_fail: warn
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.warned).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(2);

      const checkResult = result.results[0]!;
      expect(checkResult.status).toBe("warn");
      expect(checkResult.findings).toBeDefined();
      expect(checkResult.findings!).toHaveLength(2);
      expect(checkResult.findings![0].ruleId).toBe("my_forbidden_contract");
      expect(checkResult.findings![0].file).toBe("mypackage/foo.py");
      expect(checkResult.findings![0].line).toBe(8);
      expect(checkResult.findings![1].line).toBe(16);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("produces fail result with findings when on_fail is fail", async () => {
    const brokenOutput = `
=============
Import Linter
=============

----------------
Broken contracts
----------------

api_boundary
------------

mypackage.api is not allowed to import mypackage.internals:

  mypackage.api:10: from mypackage.internals import secret
`;

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 1,
      stdout: new TextEncoder().encode(brokenOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-IL-003
description: strict import boundaries
type: atomic
trigger: commit
scope: global
checks:
  - name: strict imports
    import_linter:
      config: .importlinter
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.totalFindings).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
      expect(result.results[0]!.findings![0].ruleId).toBe("api_boundary");
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("passes when all contracts are kept", async () => {
    const cleanOutput = `
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

    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: 0,
      stdout: new TextEncoder().encode(cleanOutput),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-IL-004
description: clean imports
type: atomic
trigger: commit
scope: global
checks:
  - name: all kept
    import_linter: {}
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalFindings).toBe(0);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("fails gracefully when lint-imports tool is not found", async () => {
    (Bun as any).spawnSync = (_cmd: string[], _opts?: any) => ({
      exitCode: null,
      stdout: new Uint8Array(0),
      stderr: new Uint8Array(0),
    });

    try {
      const contract = parseContract(`
id: INT-IL-005
description: tool not found test
type: atomic
trigger: commit
scope: global
checks:
  - name: lint-imports not installed
    import_linter: {}
    on_fail: fail
`);

      const result = await runAudit([contract], "commit", TMP);
      expect(result.failed).toBe(1);
      expect(result.results[0]!.status).toBe("fail");
      expect(result.results[0]!.message).toMatch(/lint-imports|import.linter/i);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });

  it("totalFindings aggregates findings across multiple analyzer contracts", async () => {
    const astGrepMatches = JSON.stringify([
      {
        ruleId: "no-console",
        message: "Remove console.log",
        severity: "error",
        file: "src/app.ts",
        range: { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
      },
    ]);

    const dcOutput = JSON.stringify({
      summary: {
        violations: [
          {
            type: "dependency",
            from: "src/a.ts",
            to: "src/b.ts",
            rule: { name: "no-circular", severity: "error" },
          },
          {
            type: "dependency",
            from: "src/c.ts",
            to: "src/d.ts",
            rule: { name: "not-to-test", severity: "error" },
          },
        ],
      },
    });

    let callCount = 0;
    (Bun as any).spawnSync = (cmd: string[], _opts?: any) => {
      callCount++;
      // First call is ast-grep (sg), second is dependency-cruiser (npx depcruise)
      if (cmd[0] === "sg") {
        return {
          exitCode: 1,
          stdout: new TextEncoder().encode(astGrepMatches),
          stderr: new Uint8Array(0),
        };
      }
      if (cmd[0] === "npx") {
        return {
          exitCode: 0,
          stdout: new TextEncoder().encode(dcOutput),
          stderr: new Uint8Array(0),
        };
      }
      return { exitCode: null, stdout: new Uint8Array(0), stderr: new Uint8Array(0) };
    };

    try {
      const astContract = parseContract(`
id: INT-MULTI-AST
description: ast-grep check
type: atomic
trigger: commit
scope: global
checks:
  - name: ast-grep findings
    ast_grep:
      rule: rules/check.yml
    on_fail: warn
`);

      const dcContract = parseContract(`
id: INT-MULTI-DC
description: dep cruiser check
type: atomic
trigger: commit
scope: global
checks:
  - name: dep cruiser findings
    dependency_cruiser:
      config: .dependency-cruiser.cjs
    on_fail: warn
`);

      const result = await runAudit([astContract, dcContract], "commit", TMP);
      expect(result.totalFindings).toBe(3); // 1 from ast-grep + 2 from dep-cruiser
      expect(result.warned).toBe(2);
      expect(result.failed).toBe(0);
    } finally {
      (Bun as any).spawnSync = originalSpawnSync;
    }
  });
});
