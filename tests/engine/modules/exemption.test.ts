// tests/engine/modules/exemption.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { findExemption } from "../../../src/engine/modules/exemption";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-exemption";

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(`${TMP}/annotated.rs`,
    `// @contract:C-042:exempt:no-stable-properties-in-this-module\nfn add() {}\n`);
  writeFileSync(`${TMP}/empty_reason.rs`,
    `// @contract:C-042:exempt:\nfn add() {}\n`);
  writeFileSync(`${TMP}/no_annotation.rs`,
    `fn add(a: i32, b: i32) -> i32 { a + b }\n`);
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("findExemption", () => {
  it("finds a valid exemption with reason", async () => {
    const result = await findExemption(`${TMP}/annotated.rs`, "C-042");
    expect(result).not.toBeNull();
    expect(result!.reason).toBe("no-stable-properties-in-this-module");
  });

  it("rejects exemption with empty reason", async () => {
    const result = await findExemption(`${TMP}/empty_reason.rs`, "C-042");
    expect(result).toBeNull();
  });

  it("returns null when no annotation exists", async () => {
    const result = await findExemption(`${TMP}/no_annotation.rs`, "C-042");
    expect(result).toBeNull();
  });

  it("does not match a different contract id", async () => {
    const result = await findExemption(`${TMP}/annotated.rs`, "C-043");
    expect(result).toBeNull();
  });
});
