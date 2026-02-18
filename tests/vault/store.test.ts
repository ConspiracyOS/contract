// tests/vault/store.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readVault, writeVault } from "../../src/vault/store";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-vault-store-test";

beforeAll(() => {
  mkdirSync(`${TMP}/.agent`, { recursive: true });
  writeFileSync(`${TMP}/.vault_password`, "test-passphrase\n");
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("vault store", () => {
  it("returns empty object when vault does not exist", () => {
    expect(readVault(TMP)).toEqual({});
  });

  it("round-trips data through write then read", () => {
    writeVault(TMP, { API_KEY: "secret123", DB_URL: "postgres://localhost/db" });
    const data = readVault(TMP);
    expect(data["API_KEY"]).toBe("secret123");
    expect(data["DB_URL"]).toBe("postgres://localhost/db");
  });

  it("overwrites all keys on write", () => {
    writeVault(TMP, { API_KEY: "new-secret" });
    const data = readVault(TMP);
    expect(data["API_KEY"]).toBe("new-secret");
    expect(data["DB_URL"]).toBeUndefined();
  });

  it("throws when no password file exists", () => {
    const emptyRoot = `${TMP}/no-password`;
    mkdirSync(`${emptyRoot}/.agent`, { recursive: true });
    expect(() => readVault(emptyRoot)).toThrow();
  });
});
