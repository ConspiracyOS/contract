// tests/engine/modules/env.test.ts
import { describe, it, expect } from "bun:test";
import { checkEnvVar, checkNoEnvVar, checkCommandAvailable } from "../../../src/engine/modules/env";

describe("checkEnvVar", () => {
  it("passes when env var is set", async () => {
    process.env.TEST_VAR = "hello";
    expect(await checkEnvVar("TEST_VAR")).toBe(true);
  });
  it("passes when value matches pattern", async () => {
    process.env.TEST_VAR = "/usr/local/bin/python";
    expect(await checkEnvVar("TEST_VAR", { matches: "^/usr" })).toBe(true);
  });
  it("fails when env var is unset", async () => {
    delete process.env.TEST_VAR;
    expect(await checkEnvVar("TEST_VAR")).toBe(false);
  });
});

describe("checkNoEnvVar", () => {
  it("passes when env var is not set", async () => {
    delete process.env.TEST_VAR;
    expect(await checkNoEnvVar("TEST_VAR")).toBe(true);
  });
  it("fails when matching pattern is set", async () => {
    process.env.VIRTUAL_ENV = "/usr/local/venv";
    expect(await checkNoEnvVar("VIRTUAL_ENV", "^/usr")).toBe(false);
    delete process.env.VIRTUAL_ENV;
  });
});

describe("checkCommandAvailable", () => {
  it("passes for a known command", async () => {
    expect(await checkCommandAvailable("bun")).toBe(true);
  });
  it("fails for a nonexistent command", async () => {
    expect(await checkCommandAvailable("definitely-not-a-real-command-xyz")).toBe(false);
  });
});
