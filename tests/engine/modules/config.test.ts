// tests/engine/modules/config.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { checkYamlKey, checkJsonKey } from "../../../src/engine/modules/config";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-config";

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(`${TMP}/config.yaml`, `project: my-app\nnested:\n  runner: self-hosted\n`);
  writeFileSync(`${TMP}/pkg.json`, JSON.stringify({ version: "1.0.0", private: true }));
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
});
