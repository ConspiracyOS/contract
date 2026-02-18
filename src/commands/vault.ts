// src/commands/vault.ts
import { readVault, writeVault } from "../vault/store";
import { existsSync, writeFileSync } from "fs";
import { encrypt } from "../vault/crypto";
import { resolvePassphrase } from "../vault/passphrase";
import yaml from "js-yaml";

function getProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(`${dir}/.agent/config.yaml`) || existsSync(`${dir}/.git`)) return dir;
    dir = dir.split("/").slice(0, -1).join("/") || "/";
  }
  return process.cwd();
}

export function vaultGet(key: string): void {
  const root = getProjectRoot();
  const data = readVault(root);
  if (!(key in data)) {
    console.error(`Key "${key}" not found in vault.`);
    process.exit(1);
  }
  process.stdout.write(data[key]! + "\n");
}

export function vaultSet(key: string, value: string): void {
  const root = getProjectRoot();
  const data = readVault(root);
  data[key] = value;
  writeVault(root, data);
  console.log(`Set ${key} in vault.`);
}

export function vaultList(): void {
  const root = getProjectRoot();
  const data = readVault(root);
  const keys = Object.keys(data);
  if (keys.length === 0) {
    console.log("Vault is empty.");
    return;
  }
  keys.forEach(k => console.log(k));
}

export function vaultExport(): void {
  const root = getProjectRoot();
  const data = readVault(root);
  for (const [k, v] of Object.entries(data)) {
    process.stdout.write(`export ${k}=${JSON.stringify(v)}\n`);
  }
}

export function vaultInit(): void {
  const root = getProjectRoot();
  const vaultPath = `${root}/.agent/vault`;
  if (existsSync(vaultPath)) {
    console.log("Vault already exists.");
    return;
  }
  const passphrase = resolvePassphrase(root);
  writeFileSync(vaultPath, encrypt(yaml.dump({}), passphrase));
  console.log("Vault initialised at .agent/vault");
}
