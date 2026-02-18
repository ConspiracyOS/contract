// tests/engine/modules/filesystem.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { checkPathExists, checkPathNotExists } from "../../../src/engine/modules/filesystem";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-fs";

beforeAll(() => {
  mkdirSync(`${TMP}/subdir`, { recursive: true });
  writeFileSync(`${TMP}/file.txt`, "hello");
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("checkPathExists", () => {
  it("passes for existing file", async () => {
    expect(await checkPathExists(`${TMP}/file.txt`)).toBe(true);
  });
  it("passes for existing directory", async () => {
    expect(await checkPathExists(`${TMP}/subdir`, "directory")).toBe(true);
  });
  it("fails for missing path", async () => {
    expect(await checkPathExists(`${TMP}/missing`)).toBe(false);
  });
  it("fails when type is directory but path is a file", async () => {
    expect(await checkPathExists(`${TMP}/file.txt`, "directory")).toBe(false);
  });
});

describe("checkPathNotExists", () => {
  it("passes when path is absent", async () => {
    expect(await checkPathNotExists(`${TMP}/missing`)).toBe(true);
  });
  it("fails when path exists", async () => {
    expect(await checkPathNotExists(`${TMP}/file.txt`)).toBe(false);
  });
});
