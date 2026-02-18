// tests/vault/crypto.test.ts
import { describe, it, expect } from "bun:test";
import { encrypt, decrypt } from "../../src/vault/crypto";

describe("vault crypto", () => {
  it("round-trips plaintext", () => {
    const plaintext = "KEY: secret\nOTHER: value\n";
    const passphrase = "test-passphrase-123";
    expect(decrypt(encrypt(plaintext, passphrase), passphrase)).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const p = "key: value\n";
    const pass = "passphrase";
    expect(encrypt(p, pass)).not.toBe(encrypt(p, pass));
  });

  it("throws on wrong passphrase", () => {
    const enc = encrypt("key: value\n", "correct");
    expect(() => decrypt(enc, "wrong")).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const enc = encrypt("key: value\n", "passphrase");
    const parsed = JSON.parse(enc);
    parsed.ciphertext = "AAAA" + parsed.ciphertext.slice(4);
    expect(() => decrypt(JSON.stringify(parsed), "passphrase")).toThrow();
  });
});
