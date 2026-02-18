// src/vault/store.ts
import yaml from "js-yaml";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { encrypt, decrypt } from "./crypto";
import { resolvePassphrase } from "./passphrase";

const VAULT_PATH = (root: string) => `${root}/.agent/vault`;

export function readVault(projectRoot: string): Record<string, string> {
  const vaultPath = VAULT_PATH(projectRoot);
  const passphrase = resolvePassphrase(projectRoot);
  if (!existsSync(vaultPath)) return {};
  const plaintext = decrypt(readFileSync(vaultPath, "utf8"), passphrase);
  return (yaml.load(plaintext) as Record<string, string>) ?? {};
}

export function writeVault(projectRoot: string, data: Record<string, string>): void {
  const vaultPath = VAULT_PATH(projectRoot);
  const passphrase = resolvePassphrase(projectRoot);
  writeFileSync(vaultPath, encrypt(yaml.dump(data), passphrase));
}
