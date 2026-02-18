// src/vault/passphrase.ts
import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

export function resolvePassphrase(projectRoot: string): string {
  const scriptPath = `${projectRoot}/.vault_password.sh`;
  if (existsSync(scriptPath)) {
    const result = spawnSync(scriptPath, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`vault_password.sh failed: ${result.stderr}`);
    return result.stdout.trim();
  }

  const passwordPath = `${projectRoot}/.vault_password`;
  if (existsSync(passwordPath)) {
    return readFileSync(passwordPath, "utf8").trim();
  }

  throw new Error(
    "No vault password found. Create .vault_password (plaintext) or .vault_password.sh (script returning passphrase)."
  );
}
