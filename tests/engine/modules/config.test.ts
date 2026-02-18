// tests/engine/modules/config.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { checkYamlKey, checkJsonKey, checkTomlKey } from "../../../src/engine/modules/config";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-config";

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(`${TMP}/config.yaml`, `project: my-app\nnested:\n  runner: self-hosted\n`);
  writeFileSync(`${TMP}/pkg.json`, JSON.stringify({ version: "1.0.0", private: true }));
  writeFileSync(`${TMP}/config.toml`, `[project]\nname = "my-app"\nversion = "2.0.0"\n\n[project.nested]\nrunner = "self-hosted"\n`);
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("checkYamlKey", () => {
  it("passes when key equals expected value", async () => {
    expect(await checkYamlKey(`${TMP}/config.yaml`, "project", { equals: "my-app" })).toBe(true);
  });
  it("passes for nested key with dot notation", async () => {
    expect(await checkYamlKey(`${TMP}/config.yaml`, "nested.runner", { equals: "self-hosted" })).toBe(true);
  });
  it("fails when value does not match", async () => {
    expect(await checkYamlKey(`${TMP}/config.yaml`, "project", { equals: "other" })).toBe(false);
  });
  it("passes when key exists (no value check)", async () => {
    expect(await checkYamlKey(`${TMP}/config.yaml`, "project", { exists: true })).toBe(true);
  });
});

describe("checkJsonKey", () => {
  it("passes when json key matches", async () => {
    expect(await checkJsonKey(`${TMP}/pkg.json`, "version", { equals: "1.0.0" })).toBe(true);
  });

  it("returns false (not a crash) when JSON is malformed", async () => {
    writeFileSync(`${TMP}/broken.json`, "{ not valid json ]]]");
    expect(await checkJsonKey(`${TMP}/broken.json`, "version", { equals: "1.0.0" })).toBe(false);
  });

  it("returns false (not a crash) when matches contains invalid regex", async () => {
    expect(await checkJsonKey(`${TMP}/pkg.json`, "version", { matches: "[invalid(" })).toBe(false);
  });
});

describe("checkTomlKey", () => {
  it("passes when toml key equals expected value", async () => {
    expect(await checkTomlKey(`${TMP}/config.toml`, "project.name", { equals: "my-app" })).toBe(true);
  });
  it("passes for nested key with dot notation", async () => {
    expect(await checkTomlKey(`${TMP}/config.toml`, "project.nested.runner", { equals: "self-hosted" })).toBe(true);
  });
  it("fails when value does not match", async () => {
    expect(await checkTomlKey(`${TMP}/config.toml`, "project.name", { equals: "other" })).toBe(false);
  });
  it("passes when key exists", async () => {
    expect(await checkTomlKey(`${TMP}/config.toml`, "project.version", { exists: true })).toBe(true);
  });
  it("returns false (not a crash) when TOML is malformed", async () => {
    writeFileSync(`${TMP}/broken.toml`, "this is [not valid\ntoml = [[[\n");
    expect(await checkTomlKey(`${TMP}/broken.toml`, "key", { equals: "value" })).toBe(false);
  });
});
