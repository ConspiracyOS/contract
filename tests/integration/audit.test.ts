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
