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
