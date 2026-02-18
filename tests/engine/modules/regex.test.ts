// tests/engine/modules/regex.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { checkRegexInFile, checkNoRegexInFile } from "../../../src/engine/modules/regex";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-regex";

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(`${TMP}/has_proptest.rs`, 'use proptest::prelude::*;\n');
  writeFileSync(`${TMP}/no_proptest.rs`, 'fn add(a: i32, b: i32) -> i32 { a + b }\n');
  writeFileSync(`${TMP}/compose.yml`, 'ports:\n  - "8080:80"\n');
});

afterAll(() => rmSync(TMP, { recursive: true }));

describe("checkRegexInFile", () => {
  it("passes when pattern is found in file", async () => {
    const result = await checkRegexInFile(`${TMP}/has_proptest.rs`, "proptest::");
    expect(result).toBe(true);
  });

  it("fails when pattern is not found", async () => {
    const result = await checkRegexInFile(`${TMP}/no_proptest.rs`, "proptest::");
    expect(result).toBe(false);
  });
});

describe("checkNoRegexInFile", () => {
  it("passes when pattern is absent", async () => {
    const result = await checkNoRegexInFile(`${TMP}/has_proptest.rs`, '"[0-9]+:[0-9]+"');
    expect(result).toBe(true);
  });

  it("fails when pattern is present", async () => {
    const result = await checkNoRegexInFile(`${TMP}/compose.yml`, '"[0-9]+:[0-9]+"');
    expect(result).toBe(false);
  });
});

describe("invalid regex handling", () => {
  it("returns false (not a crash) when pattern is invalid regex syntax", async () => {
    const result = await checkRegexInFile(`${TMP}/has_proptest.rs`, "(unclosed");
    expect(result).toBe(false);
  });
});
