# Phase 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 2 of agent-config: remaining stack contracts, documentation + secrets contracts, vault CLI, contract/spec CLI commands, and C-PROC04 coverage check.

**Architecture:** Six groups of tasks in dependency order: (A) stack contracts → (B) new built-in contracts → (C) vault/secrets → (D) `contract` commands → (E) `spec` commands → (F) C-PROC04 engine. Each group is independently testable. All new CLI commands wired into `src/index.ts` in the final task of each group.

**Tech Stack:** Bun + TypeScript (strict), js-yaml, zod, @inquirer/prompts, Node.js built-in `crypto` (for vault — no new dependencies), commander.

---

## Group A — Remaining Stack Contracts

### Task 1: Rails stack contracts

**Files:**
- Create: `src/stacks/rails.ts`
- Modify: `src/builtins/index.ts`

**Step 1: Create `src/stacks/rails.ts`**

```typescript
// src/stacks/rails.ts
// @contract:C-PROC03:exempt:contract-definition-file-contains-find_by-as-literal-text
export const RB_CONTRACTS = [
  `id: C-RB01
description: Rubocop linting must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: bundle exec rubocop
    command:
      run: "bundle exec rubocop --format progress 2>&1 | tail -3"
      exit_code: 0
    on_fail: fail`,

  `id: C-RB02
description: Rails test suite must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: bundle exec rails test
    command:
      run: "bundle exec rails test 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail
    skip_if:
      path_not_exists: test`,

  `id: C-RB03
description: find_by calls must include nil guard
type: atomic
trigger: commit
scope:
  paths: ["app/**/*.rb"]
  exclude: ["**/*_test.rb", "spec/**/*"]
checks:
  - name: no bare find_by without nil guard
    no_regex_in_file:
      pattern: '\\.find_by\\([^)]+\\)\\.'
    on_fail: require_exemption`,
];
```

**Step 2: Add Rails to `src/builtins/index.ts`**

```typescript
import { RB_CONTRACTS } from "../stacks/rails";
// in loadBuiltinContracts:
if (stacks.includes("rails")) yamls.push(...RB_CONTRACTS);
```

**Step 3: Verify contracts parse**

```bash
bun -e "import { RB_CONTRACTS } from './src/stacks/rails.ts'; import { parseContract } from './src/engine/parser.ts'; RB_CONTRACTS.forEach(y => parseContract(y)); console.log('OK')"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add src/stacks/rails.ts src/builtins/index.ts
git commit -m "feat(stacks): Rails built-in contracts C-RB01–C-RB03"
```

---

### Task 2: Rust stack contracts

**Files:**
- Create: `src/stacks/rust.ts`
- Modify: `src/builtins/index.ts`

**Step 1: Create `src/stacks/rust.ts`**

```typescript
// src/stacks/rust.ts
export const RS_CONTRACTS = [
  `id: C-RS01
description: cargo clippy must pass with no warnings
type: atomic
trigger: commit
scope: global
checks:
  - name: cargo clippy clean
    command:
      run: "cargo clippy -- -D warnings 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail`,

  `id: C-RS02
description: cargo fmt must be clean
type: atomic
trigger: commit
scope: global
checks:
  - name: cargo fmt check
    command:
      run: "cargo fmt --check 2>&1"
      exit_code: 0
    on_fail: fail`,

  `id: C-RS03
description: All Rust modules must include property-based tests
type: atomic
trigger: pr
scope:
  paths: ["src/**/*.rs", "lib/**/*.rs"]
  exclude: ["**/build.rs", "**/*.pb.rs", "**/benches/**", "**/tests/**"]
checks:
  - name: proptest import present
    regex_in_file:
      pattern: "proptest::"
    on_fail: require_exemption`,
];
```

**Step 2: Add Rust to `src/builtins/index.ts`**

```typescript
import { RS_CONTRACTS } from "../stacks/rust";
// in loadBuiltinContracts:
if (stacks.includes("rust")) yamls.push(...RS_CONTRACTS);
```

**Step 3: Verify contracts parse**

```bash
bun -e "import { RS_CONTRACTS } from './src/stacks/rust.ts'; import { parseContract } from './src/engine/parser.ts'; RS_CONTRACTS.forEach(y => parseContract(y)); console.log('OK')"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add src/stacks/rust.ts src/builtins/index.ts
git commit -m "feat(stacks): Rust built-in contracts C-RS01–C-RS03"
```

---

### Task 3: Mobile stack contracts

**Files:**
- Create: `src/stacks/mobile.ts`
- Modify: `src/builtins/index.ts`

**Step 1: Create `src/stacks/mobile.ts`**

```typescript
// src/stacks/mobile.ts
export const MO_CONTRACTS = [
  `id: C-MO01
description: expo-doctor must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: expo-doctor
    command:
      run: "npx expo-doctor 2>&1 | tail -5"
      exit_code: 0
    on_fail: warn
    skip_if:
      path_not_exists: app.json`,

  `id: C-MO02
description: No hardcoded localhost in non-test source
type: atomic
trigger: commit
scope:
  paths: ["src/**/*", "app/**/*", "components/**/*"]
  exclude: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"]
checks:
  - name: no hardcoded localhost
    no_regex_in_file:
      pattern: "localhost"
    on_fail: require_exemption`,
];
```

**Step 2: Add Mobile to `src/builtins/index.ts`**

```typescript
import { MO_CONTRACTS } from "../stacks/mobile";
// in loadBuiltinContracts:
if (stacks.includes("mobile")) yamls.push(...MO_CONTRACTS);
```

**Step 3: Verify and commit**

```bash
bun -e "import { MO_CONTRACTS } from './src/stacks/mobile.ts'; import { parseContract } from './src/engine/parser.ts'; MO_CONTRACTS.forEach(y => parseContract(y)); console.log('OK')"
git add src/stacks/mobile.ts src/builtins/index.ts
git commit -m "feat(stacks): Mobile built-in contracts C-MO01–C-MO02"
```

---

### Task 4: Containers stack contracts

**Files:**
- Create: `src/stacks/containers.ts`
- Modify: `src/builtins/index.ts`

**Step 1: Create `src/stacks/containers.ts`**

```typescript
// src/stacks/containers.ts
export const CT_CONTRACTS = [
  `id: C-CT01
description: Docker services must not bind ports to host
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no host port binding
    no_regex_in_file:
      pattern: '"[0-9]+:[0-9]+"'
    on_fail: fail`,

  `id: C-CT03
description: No latest image tags in compose files
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no latest tag
    no_regex_in_file:
      pattern: ":latest"
    on_fail: warn`,

  `id: C-CT04
description: No localhost references in container service configs
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no localhost in service config
    no_regex_in_file:
      pattern: "localhost"
    on_fail: require_exemption`,
];
```

**Step 2: Add Containers to `src/builtins/index.ts`**

```typescript
import { CT_CONTRACTS } from "../stacks/containers";
// in loadBuiltinContracts:
if (stacks.includes("containers")) yamls.push(...CT_CONTRACTS);
```

**Step 3: Verify and commit**

```bash
bun -e "import { CT_CONTRACTS } from './src/stacks/containers.ts'; import { parseContract } from './src/engine/parser.ts'; CT_CONTRACTS.forEach(y => parseContract(y)); console.log('OK')"
git add src/stacks/containers.ts src/builtins/index.ts
git commit -m "feat(stacks): Containers built-in contracts C-CT01, C-CT03, C-CT04"
```

---

### Task 5: Run full test suite after stack additions

**Step 1: Run tests**

```bash
bun test
```
Expected: all tests pass (no new tests needed — stacks are just YAML strings validated by parse).

**Step 2: Update README stacks table**

In `README.md`, add rows to the stack contracts table:

```markdown
| C-RB01 | Rails | pr | `bundle exec rubocop` passes |
| C-RB02 | Rails | pr | `bundle exec rails test` passes |
| C-RB03 | Rails | commit | No bare `find_by` without nil guard |
| C-RS01 | Rust | commit | `cargo clippy -- -D warnings` passes |
| C-RS02 | Rust | commit | `cargo fmt --check` passes |
| C-RS03 | Rust | pr | All modules include `proptest::` |
| C-MO01 | Mobile | pr | `expo-doctor` passes |
| C-MO02 | Mobile | commit | No hardcoded `localhost` in source |
| C-CT01 | Containers | commit | No host port binding in compose files |
| C-CT03 | Containers | commit | No `latest` image tags |
| C-CT04 | Containers | commit | No `localhost` in service configs |
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README with all stack contracts"
```

---

## Group B — New Built-in Process Contracts

### Task 6: Documentation discipline contracts (C-DOC01, C-DOC02)

**Files:**
- Modify: `src/builtins/proc.ts`

**Step 1: Append to `PROC_CONTRACTS` in `src/builtins/proc.ts`**

Add after the existing contracts:

```typescript
  // C-DOC01: ARCHITECTURE.md must exist
  `id: C-DOC01
description: docs/ARCHITECTURE.md must exist
type: atomic
trigger: commit
scope: global
checks:
  - name: ARCHITECTURE.md present
    path_exists:
      path: docs/ARCHITECTURE.md
    on_fail: fail
    skip_if:
      path_not_exists: docs`,

  // C-DOC02: docs/ markdown files must declare type header
  `id: C-DOC02
description: Markdown files in docs/ must have a type header
type: atomic
trigger: commit
scope:
  paths: ["docs/*.md"]
checks:
  - name: type header present
    regex_in_file:
      pattern: "<!-- type:"
    on_fail: warn
    skip_if:
      path_not_exists: docs`,
```

**Step 2: Verify parse**

```bash
bun -e "import { PROC_CONTRACTS } from './src/builtins/proc.ts'; import { parseContract } from './src/engine/parser.ts'; PROC_CONTRACTS.forEach(y => parseContract(y)); console.log(PROC_CONTRACTS.length, 'contracts OK')"
```
Expected: `7 contracts OK`

**Step 3: Run tests**

```bash
bun test
```
Expected: all pass.

**Step 4: Commit**

```bash
git add src/builtins/proc.ts
git commit -m "feat(builtins): documentation discipline contracts C-DOC01, C-DOC02"
```

---

### Task 7: Secrets contracts (C-SEC01, C-SEC03)

**Files:**
- Modify: `src/builtins/proc.ts`

**Step 1: Append to `PROC_CONTRACTS`**

```typescript
  // C-SEC01: .env files must not be committed (must be in .gitignore)
  `id: C-SEC01
description: .env files must be gitignored
type: atomic
trigger: commit
scope:
  paths: [".gitignore"]
checks:
  - name: .env in .gitignore
    regex_in_file:
      pattern: "^\\.env"
    on_fail: fail`,

  // C-SEC03: vault password files must be gitignored
  `id: C-SEC03
description: .vault_password files must be gitignored
type: atomic
trigger: commit
scope:
  paths: [".gitignore"]
checks:
  - name: .vault_password in .gitignore
    regex_in_file:
      pattern: "^\\.vault_password"
    on_fail: fail
    skip_if:
      path_not_exists: .agent/vault`,
```

**Step 2: Verify, test, commit**

```bash
bun -e "import { PROC_CONTRACTS } from './src/builtins/proc.ts'; import { parseContract } from './src/engine/parser.ts'; PROC_CONTRACTS.forEach(y => parseContract(y)); console.log(PROC_CONTRACTS.length, 'contracts OK')"
bun test
git add src/builtins/proc.ts
git commit -m "feat(builtins): secrets contracts C-SEC01, C-SEC03"
```

---

## Group C — Vault / Secrets

### Task 8: Vault crypto module

Uses Node.js built-in `crypto` — no new dependencies.

**Files:**
- Create: `src/vault/crypto.ts`
- Create: `tests/vault/crypto.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/vault/crypto.test.ts
```
Expected: FAIL — `encrypt` not found

**Step 3: Implement `src/vault/crypto.ts`**

```typescript
// src/vault/crypto.ts
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "crypto";

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const DIGEST = "sha256";
const ALGORITHM = "aes-256-gcm";

interface VaultEnvelope {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LEN, DIGEST);
}

export function encrypt(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: VaultEnvelope = {
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
  return JSON.stringify(envelope);
}

export function decrypt(vaultContent: string, passphrase: string): string {
  const envelope = JSON.parse(vaultContent) as VaultEnvelope;
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/vault/crypto.test.ts
```
Expected: 4 passed

**Step 5: Commit**

```bash
git add src/vault/crypto.ts tests/vault/crypto.test.ts
git commit -m "feat(vault): AES-256-GCM crypto module with PBKDF2 key derivation"
```

---

### Task 9: Vault passphrase resolver + store

**Files:**
- Create: `src/vault/passphrase.ts`
- Create: `src/vault/store.ts`
- Create: `tests/vault/store.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — verify fails**

```bash
bun test tests/vault/store.test.ts
```
Expected: FAIL

**Step 3: Implement `src/vault/passphrase.ts`**

```typescript
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
```

**Step 4: Implement `src/vault/store.ts`**

```typescript
// src/vault/store.ts
import yaml from "js-yaml";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { encrypt, decrypt } from "./crypto";
import { resolvePassphrase } from "./passphrase";

const VAULT_PATH = (root: string) => `${root}/.agent/vault`;

export function readVault(projectRoot: string): Record<string, string> {
  const vaultPath = VAULT_PATH(projectRoot);
  if (!existsSync(vaultPath)) return {};
  const passphrase = resolvePassphrase(projectRoot);
  const plaintext = decrypt(readFileSync(vaultPath, "utf8"), passphrase);
  return (yaml.load(plaintext) as Record<string, string>) ?? {};
}

export function writeVault(projectRoot: string, data: Record<string, string>): void {
  const vaultPath = VAULT_PATH(projectRoot);
  const passphrase = resolvePassphrase(projectRoot);
  writeFileSync(vaultPath, encrypt(yaml.dump(data), passphrase));
}
```

**Step 5: Run tests — verify all pass**

```bash
bun test tests/vault/store.test.ts
```
Expected: 4 passed

**Step 6: Commit**

```bash
git add src/vault/passphrase.ts src/vault/store.ts tests/vault/store.test.ts
git commit -m "feat(vault): passphrase resolver and encrypted store"
```

---

### Task 10: `vault` CLI command

**Files:**
- Create: `src/commands/vault.ts`
- Modify: `src/index.ts`

**Step 1: Implement `src/commands/vault.ts`**

```typescript
// src/commands/vault.ts
import { readVault, writeVault } from "../vault/store";
import { existsSync, writeFileSync } from "fs";
import { encrypt } from "../vault/crypto";
import { resolvePassphrase } from "../vault/passphrase";
import yaml from "js-yaml";

function getProjectRoot(): string {
  // Reuse the same logic as audit command
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
```

**Step 2: Wire into `src/index.ts`**

Add after the `install` command:

```typescript
import { vaultGet, vaultSet, vaultList, vaultExport, vaultInit } from "./commands/vault";

const vault = program.command("vault").description("Manage encrypted project secrets");

vault.command("get <key>").description("Print a secret value").action(vaultGet);
vault.command("set <key> <value>").description("Store a secret value").action(vaultSet);
vault.command("list").description("List all secret keys (no values)").action(vaultList);
vault.command("export").description("Print export statements for shell sourcing").action(vaultExport);
vault.command("init").description("Initialise empty vault (requires .vault_password)").action(vaultInit);
```

**Step 3: Smoke test**

```bash
cd /tmp && mkdir vault-test && cd vault-test && git init
echo "test-passphrase" > .vault_password
mkdir -p .agent
bun run /Users/vegard/Developer/agent-config/src/index.ts vault init
bun run /Users/vegard/Developer/agent-config/src/index.ts vault set API_KEY my-secret
bun run /Users/vegard/Developer/agent-config/src/index.ts vault get API_KEY
bun run /Users/vegard/Developer/agent-config/src/index.ts vault list
bun run /Users/vegard/Developer/agent-config/src/index.ts vault export
```
Expected: `my-secret` printed on `get`, `API_KEY` on `list`, `export API_KEY="my-secret"` on `export`.

**Step 4: Run full test suite**

```bash
bun test
```
Expected: all pass.

**Step 5: Commit**

```bash
git add src/commands/vault.ts src/index.ts
git commit -m "feat: vault command (get, set, list, export, init)"
```

---

## Group D — `contract` Commands

### Task 11: `contract list` and `contract check`

**Files:**
- Create: `src/commands/contract.ts`
- Modify: `src/index.ts`

**Step 1: Implement `src/commands/contract.ts` (list + check)**

```typescript
// src/commands/contract.ts
import yaml from "js-yaml";
import { existsSync, readFileSync } from "fs";
import { Glob } from "bun";
import { loadBuiltinContracts } from "../builtins/index";
import { parseContractFile } from "../engine/parser";
import { runAudit } from "../engine/audit";
import { printAuditResult } from "../engine/reporter";
import type { Contract, ContractTrigger } from "../engine/types";
import type { ProjectConfig } from "../init/config";
import type { Stack } from "../init/detector";

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(`${dir}/.agent/config.yaml`) || existsSync(`${dir}/.git`)) return dir;
    dir = dir.split("/").slice(0, -1).join("/") || "/";
  }
  return process.cwd();
}

async function loadAllContracts(projectRoot: string): Promise<Contract[]> {
  let stacks: Stack[] = [];
  const configPath = `${projectRoot}/.agent/config.yaml`;
  if (existsSync(configPath)) {
    const cfg = yaml.load(readFileSync(configPath, "utf8")) as ProjectConfig;
    stacks = cfg.stack ?? [];
  }
  const builtins = loadBuiltinContracts(stacks);

  const projectContracts: Contract[] = [];
  const contractDir = `${projectRoot}/.agent/contracts`;
  if (existsSync(contractDir)) {
    const glob = new Glob("**/*.yaml");
    for await (const file of glob.scan({ cwd: contractDir, absolute: true })) {
      try { projectContracts.push(parseContractFile(file)); } catch { /* skip invalid */ }
    }
  }
  return [...builtins, ...projectContracts];
}

function scopeSummary(scope: Contract["scope"]): string {
  if (scope === "global") return "global";
  const paths = scope.paths ?? ["**/*"];
  return paths.join(", ").slice(0, 40);
}

export async function contractList(): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const builtinIds = new Set(loadBuiltinContracts().map(c => c.id));

  console.log("\n" + "ID".padEnd(14) + "TRIGGER".padEnd(10) + "SCOPE".padEnd(42) + "SOURCE");
  console.log("-".repeat(80));
  for (const c of contracts) {
    const source = builtinIds.has(c.id) ? "builtin" : "project";
    console.log(c.id.padEnd(14) + c.trigger.padEnd(10) + scopeSummary(c.scope).padEnd(42) + source);
  }
  console.log(`\n${contracts.length} contract(s)\n`);
}

export async function contractCheck(id: string, options: { trigger?: string }): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const contract = contracts.find(c => c.id === id);
  if (!contract) {
    console.error(`Contract "${id}" not found. Run \`agent-config contract list\` to see available contracts.`);
    process.exit(1);
  }
  const trigger = (options.trigger ?? contract.trigger) as ContractTrigger;
  const result = await runAudit([contract], trigger, root);
  printAuditResult(result);
  if (result.failed > 0) process.exit(1);
}
```

**Step 2: Wire into `src/index.ts`**

```typescript
import { contractList, contractCheck, contractNew } from "./commands/contract";

const contractCmd = program.command("contract").description("Manage contracts");

contractCmd.command("list").description("List all contracts (builtins + project)").action(contractList);

contractCmd
  .command("check <id>")
  .description("Run a single contract by ID")
  .option("--trigger <trigger>", "Override trigger context")
  .action(contractCheck);
```

**Step 3: Smoke test**

```bash
bun run src/index.ts contract list
bun run src/index.ts contract check C-PROC05
```
Expected: table output on `list`; audit result on `check`.

**Step 4: Run tests and commit**

```bash
bun test
git add src/commands/contract.ts src/index.ts
git commit -m "feat: contract list and contract check commands"
```

---

### Task 12: `contract new` — interactive scaffold

**Files:**
- Modify: `src/commands/contract.ts`

**Step 1: Implement `contractNew` function**

Add to `src/commands/contract.ts`:

```typescript
import { input, select, confirm } from "@inquirer/prompts";
import { mkdirSync, writeFileSync } from "fs";

export async function contractNew(): Promise<void> {
  const root = findProjectRoot();
  const contracts = await loadAllContracts(root);
  const existingIds = new Set(contracts.map(c => c.id));

  console.log("\nagent-config contract new\n");

  const id = await input({
    message: "Contract ID (e.g. C-001):",
    validate: (v) => {
      if (!v.trim()) return "ID is required";
      if (existingIds.has(v.trim())) return `Contract "${v.trim()}" already exists`;
      return true;
    },
  });

  const description = await input({ message: "Description:" });

  const type = await select({
    message: "Type:",
    choices: [
      { name: "atomic — each file evaluated independently", value: "atomic" },
      { name: "holistic — entire project evaluated once", value: "holistic" },
    ],
  }) as "atomic" | "holistic";

  const trigger = await select({
    message: "Trigger:",
    choices: [
      { name: "commit", value: "commit" },
      { name: "pr", value: "pr" },
      { name: "merge", value: "merge" },
      { name: "schedule", value: "schedule" },
    ],
  }) as string;

  const scopeChoice = await select({
    message: "Scope:",
    choices: [
      { name: "global (contract runs once, not per file)", value: "global" },
      { name: "paths (contract runs for each matched file)", value: "paths" },
    ],
  }) as "global" | "paths";

  let scopeYaml = "scope: global";
  if (scopeChoice === "paths") {
    const paths = await input({ message: "Glob pattern(s), comma-separated (e.g. src/**/*.ts):" });
    const pathList = paths.split(",").map(p => p.trim()).filter(Boolean);
    scopeYaml = `scope:\n  paths: [${pathList.map(p => `"${p}"`).join(", ")}]`;
  }

  const checkModule = await select({
    message: "Check module:",
    choices: [
      { name: "path_exists", value: "path_exists" },
      { name: "path_not_exists", value: "path_not_exists" },
      { name: "regex_in_file", value: "regex_in_file" },
      { name: "no_regex_in_file", value: "no_regex_in_file" },
      { name: "yaml_key", value: "yaml_key" },
      { name: "json_key", value: "json_key" },
      { name: "toml_key", value: "toml_key" },
      { name: "env_var", value: "env_var" },
      { name: "no_env_var", value: "no_env_var" },
      { name: "command_available", value: "command_available" },
      { name: "command", value: "command" },
      { name: "script", value: "script" },
    ],
  }) as string;

  let checkYaml = "";
  switch (checkModule) {
    case "path_exists":
    case "path_not_exists": {
      const path = await input({ message: "Path (relative to project root):" });
      checkYaml = `    ${checkModule}:\n      path: "${path}"`;
      break;
    }
    case "regex_in_file":
    case "no_regex_in_file": {
      const pattern = await input({ message: "Regex pattern:" });
      checkYaml = `    ${checkModule}:\n      pattern: '${pattern}'`;
      break;
    }
    case "command": {
      const run = await input({ message: "Shell command to run:" });
      checkYaml = `    command:\n      run: "${run}"\n      exit_code: 0`;
      break;
    }
    case "script": {
      const path = await input({ message: "Script path (relative to project root):" });
      checkYaml = `    script:\n      path: "${path}"`;
      break;
    }
    case "command_available": {
      const name = await input({ message: "Command name (e.g. bun, gh):" });
      checkYaml = `    command_available:\n      name: "${name}"`;
      break;
    }
    default: {
      const path = await input({ message: "File path:" });
      const key = await input({ message: "Key (dot-notation):" });
      const value = await input({ message: "Expected value:" });
      checkYaml = `    ${checkModule}:\n      path: "${path}"\n      key: "${key}"\n      equals: "${value}"`;
      break;
    }
  }

  const onFail = await select({
    message: "on_fail:",
    choices: [
      { name: "fail — blocks commit/PR", value: "fail" },
      { name: "warn — shows warning but does not block", value: "warn" },
      { name: "require_exemption — fail unless @contract annotation present", value: "require_exemption" },
    ],
  }) as string;

  const checkName = await input({ message: "Check name (short description):" });

  const contractYaml = `id: ${id}
description: ${description}
type: ${type}
trigger: ${trigger}
${scopeYaml}
checks:
  - name: ${checkName}
${checkYaml}
    on_fail: ${onFail}
`;

  const contractDir = `${root}/.agent/contracts`;
  mkdirSync(contractDir, { recursive: true });
  const filePath = `${contractDir}/${id}.yaml`;
  writeFileSync(filePath, contractYaml);

  console.log(`\n✓ Contract written to .agent/contracts/${id}.yaml`);
  console.log(`  Run: agent-config contract check ${id}\n`);
}
```

**Step 2: Add `contract new` to CLI wiring in `src/index.ts`**

```typescript
contractCmd.command("new").description("Scaffold a new contract interactively").action(contractNew);
```

**Step 3: Smoke test**

```bash
cd /tmp/vault-test  # or any git repo
bun run /Users/vegard/Developer/agent-config/src/index.ts contract new
```
Walk through prompts, verify file is written and parseable:
```bash
bun -e "import { parseContractFile } from '/Users/vegard/Developer/agent-config/src/engine/parser.ts'; console.log(parseContractFile('.agent/contracts/<id>.yaml').id)"
```

**Step 4: Run tests and commit**

```bash
bun test
git add src/commands/contract.ts src/index.ts
git commit -m "feat: contract new — interactive contract scaffold"
```

---

## Group E — `spec` Commands

### Task 13: `spec new`, `spec list`, `spec status`

**Files:**
- Create: `src/commands/spec.ts`
- Modify: `src/index.ts`

**Step 1: Write failing test**

```typescript
// tests/commands/spec.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { scaffoldSpec, listSpecs, getSpecStatus } from "../../src/commands/spec";

const TMP = "/tmp/agent-config-spec-test";

beforeAll(() => mkdirSync(`${TMP}/.agent/specs`, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true }));

describe("scaffoldSpec", () => {
  it("creates RFC directory with brief.md and proposal.md", () => {
    scaffoldSpec(TMP, "user-auth", "User authentication via JWT");
    expect(existsSync(`${TMP}/.agent/specs/RFC-001-user-auth/brief.md`)).toBe(true);
    expect(existsSync(`${TMP}/.agent/specs/RFC-001-user-auth/proposal.md`)).toBe(true);
  });

  it("auto-increments RFC number", () => {
    scaffoldSpec(TMP, "rate-limit", "API rate limiting");
    expect(existsSync(`${TMP}/.agent/specs/RFC-002-rate-limit/brief.md`)).toBe(true);
  });
});

describe("listSpecs", () => {
  it("returns specs with inferred status", () => {
    const specs = listSpecs(TMP);
    expect(specs).toHaveLength(2);
    expect(specs[0]!.status).toBe("draft");
  });
});

describe("getSpecStatus", () => {
  it("returns null for unknown RFC", () => {
    expect(getSpecStatus(TMP, "RFC-999")).toBeNull();
  });

  it("returns status for known RFC", () => {
    const status = getSpecStatus(TMP, "RFC-001");
    expect(status).not.toBeNull();
    expect(status!.status).toBe("draft");
    expect(status!.files.brief).toBe(true);
    expect(status!.files.proposal).toBe(true);
    expect(status!.files.approval).toBe(false);
  });
});
```

**Step 2: Run test — verify fails**

```bash
bun test tests/commands/spec.test.ts
```
Expected: FAIL

**Step 3: Implement `src/commands/spec.ts`**

```typescript
// src/commands/spec.ts
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { input } from "@inquirer/prompts";

type SpecStatus = "draft" | "proposed" | "approved" | "implemented";

interface SpecInfo {
  id: string;
  slug: string;
  title: string;
  status: SpecStatus;
  dir: string;
}

interface SpecStatusDetail {
  id: string;
  status: SpecStatus;
  files: { brief: boolean; proposal: boolean; approval: boolean; review: boolean };
  nextAction: string;
}

function inferStatus(dir: string): SpecStatus {
  if (existsSync(`${dir}/review.md`)) return "implemented";
  if (existsSync(`${dir}/approval.md`)) return "approved";
  if (existsSync(`${dir}/proposal.md`)) return "proposed";
  return "draft";
}

function nextRfcNumber(specsDir: string): number {
  if (!existsSync(specsDir)) return 1;
  const dirs = readdirSync(specsDir).filter(d => /^RFC-\d+/.test(d));
  if (dirs.length === 0) return 1;
  const nums = dirs.map(d => parseInt(d.replace(/^RFC-(\d+).*/, "$1"), 10));
  return Math.max(...nums) + 1;
}

const BRIEF_STUB = (title: string) => `# ${title}

## Problem
<!-- What problem does this solve? -->

## Scope
<!-- What is in scope? What is explicitly out of scope? -->

## Success criteria
<!-- How will we know this is done? Be concrete. -->

## Contract coverage
<!-- Which existing contracts apply? Are new contracts needed? -->
- Applicable: (list contract IDs)
- New contracts required: (or "none")
`;

const PROPOSAL_STUB = (title: string) => `# ${title} — Proposal

## Approach
<!-- Describe the implementation approach. -->

## Acceptance criteria

> Each criterion must include a concrete example: specific inputs → expected outputs.

- [ ] **Criterion 1**: When ___ happens, ___ should occur. Example: given ___, expect ___.

## Implementation notes
<!-- Architecture decisions, dependencies, risks. -->
`;

export function scaffoldSpec(projectRoot: string, slug: string, title: string): string {
  const specsDir = `${projectRoot}/.agent/specs`;
  const num = String(nextRfcNumber(specsDir)).padStart(3, "0");
  const id = `RFC-${num}`;
  const dir = `${specsDir}/${id}-${slug}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/brief.md`, BRIEF_STUB(title));
  writeFileSync(`${dir}/proposal.md`, PROPOSAL_STUB(title));
  return dir;
}

export function listSpecs(projectRoot: string): SpecInfo[] {
  const specsDir = `${projectRoot}/.agent/specs`;
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir)
    .filter(d => /^RFC-\d+/.test(d))
    .sort()
    .map(d => {
      const dir = `${specsDir}/${d}`;
      const match = d.match(/^(RFC-\d+)-(.+)$/);
      return {
        id: match?.[1] ?? d,
        slug: match?.[2] ?? d,
        title: match?.[2]?.replace(/-/g, " ") ?? d,
        status: inferStatus(dir),
        dir,
      };
    });
}

export function getSpecStatus(projectRoot: string, rfcId: string): SpecStatusDetail | null {
  const specsDir = `${projectRoot}/.agent/specs`;
  if (!existsSync(specsDir)) return null;
  const dir = readdirSync(specsDir).find(d => d.startsWith(rfcId + "-") || d === rfcId);
  if (!dir) return null;
  const fullDir = `${specsDir}/${dir}`;
  const files = {
    brief: existsSync(`${fullDir}/brief.md`),
    proposal: existsSync(`${fullDir}/proposal.md`),
    approval: existsSync(`${fullDir}/approval.md`),
    review: existsSync(`${fullDir}/review.md`),
  };
  const status = inferStatus(fullDir);
  const nextAction =
    !files.brief ? "Create brief.md" :
    !files.proposal ? "Draft proposal.md" :
    !files.approval ? "Awaiting approval.md from owner" :
    !files.review ? "Add review.md with implementation evidence" :
    "RFC complete";
  return { id: rfcId, status, files, nextAction };
}

export async function specNew(): Promise<void> {
  const root = process.cwd();
  console.log("\nagent-config spec new\n");
  const title = await input({ message: "RFC title:" });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dir = scaffoldSpec(root, slug, title);
  const rfcId = dir.split("/").pop()!.match(/^(RFC-\d+)/)?.[1];
  console.log(`\n✓ ${rfcId} scaffolded at .agent/specs/${dir.split("/").pop()}`);
  console.log("  Next: fill in brief.md, then draft proposal.md\n");
}

export function specList(): void {
  const root = process.cwd();
  const specs = listSpecs(root);
  if (specs.length === 0) { console.log("No RFCs found."); return; }
  console.log("\n" + "ID".padEnd(10) + "STATUS".padEnd(14) + "TITLE");
  console.log("-".repeat(60));
  for (const s of specs) {
    console.log(s.id.padEnd(10) + s.status.padEnd(14) + s.title);
  }
  console.log(`\n${specs.length} RFC(s)\n`);
}

export function specStatus(id: string): void {
  const root = process.cwd();
  const detail = getSpecStatus(root, id);
  if (!detail) { console.error(`RFC "${id}" not found.`); process.exit(1); }
  console.log(`\n${detail.id} — ${detail.status.toUpperCase()}`);
  console.log(`  brief.md:    ${detail.files.brief ? "✓" : "✗"}`);
  console.log(`  proposal.md: ${detail.files.proposal ? "✓" : "✗"}`);
  console.log(`  approval.md: ${detail.files.approval ? "✓" : "✗"}`);
  console.log(`  review.md:   ${detail.files.review ? "✓" : "✗"}`);
  console.log(`\nNext action: ${detail.nextAction}\n`);
}
```

**Step 4: Wire into `src/index.ts`**

```typescript
import { specNew, specList, specStatus } from "./commands/spec";

const specCmd = program.command("spec").description("Manage RFCs");
specCmd.command("new").description("Scaffold a new RFC").action(specNew);
specCmd.command("list").description("List all RFCs with status").action(specList);
specCmd.command("status <id>").description("Show RFC lifecycle status").action(specStatus);
```

**Step 5: Run tests — verify they pass**

```bash
bun test tests/commands/spec.test.ts
```
Expected: 5 passed

**Step 6: Run full suite and commit**

```bash
bun test
git add src/commands/spec.ts tests/commands/spec.test.ts src/index.ts
git commit -m "feat: spec command (new, list, status) with RFC lifecycle management"
```

---

## Group F — C-PROC04 Coverage Check

### Task 14: Coverage check engine

**Files:**
- Modify: `src/engine/audit.ts`
- Modify: `src/init/config.ts`
- Modify: `src/commands/audit.ts`

**Step 1: Add coverage test to integration suite**

Add to `tests/integration/audit.test.ts`:

```typescript
import { mkdirSync, writeFileSync } from "fs";

describe("C-PROC04 coverage check", () => {
  it("warns on source files not covered by any contract", async () => {
    // TMP already has src/main.ts; no contract covers src/**/*.ts
    const result = await runAudit(
      [],  // no contracts
      "commit",
      TMP,
      { enabled: true, paths: ["src/**/*"] }
    );
    expect(result.warned).toBeGreaterThan(0);
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(true);
  });

  it("does not warn when files are covered by a contract", async () => {
    const contract = parseContract(`
id: INT-COVER
description: cover src files
type: atomic
trigger: commit
scope:
  paths:
    - src/**/*
checks:
  - name: any file
    path_exists:
      path: src
    on_fail: warn
`);
    const result = await runAudit(
      [contract],
      "commit",
      TMP,
      { enabled: true, paths: ["src/**/*"] }
    );
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });

  it("does not fire when enabled is false", async () => {
    const result = await runAudit([], "commit", TMP, { enabled: false, paths: ["src/**/*"] });
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });

  it("does not fire on non-commit triggers", async () => {
    const result = await runAudit([], "pr", TMP, { enabled: true, paths: ["src/**/*"] });
    expect(result.results.some(r => r.contractId === "C-PROC04")).toBe(false);
  });
});
```

**Step 2: Run test — verify fails**

```bash
bun test tests/integration/audit.test.ts
```
Expected: the 4 new tests fail (`runAudit` doesn't accept 4th argument yet)

**Step 3: Update `src/engine/audit.ts`**

```typescript
// src/engine/audit.ts
import type { AuditResult, Contract, ContractTrigger } from "./types";
import { resolveScope } from "./scope";
import { runCheck } from "./runner";
import { Glob } from "bun";

export interface CoverageOptions {
  enabled: boolean;
  paths: string[];
}

export async function auditContract(
  contract: Contract,
  trigger: ContractTrigger,
  projectRoot: string
): Promise<AuditResult["results"]> {
  if (contract.trigger !== trigger) {
    return contract.checks.map(check => ({
      contractId: contract.id,
      contractDescription: contract.description,
      checkName: check.name,
      status: "skip" as const,
      message: `trigger=${contract.trigger}, current=${trigger}`,
    }));
  }

  const files = await resolveScope(contract.scope, projectRoot);
  const results = [];
  for (const file of files) {
    for (const check of contract.checks) {
      results.push(await runCheck(contract, check, file, projectRoot));
    }
  }
  return results;
}

async function checkCoverage(
  patterns: string[],
  evaluatedFiles: Set<string>,
  projectRoot: string
): Promise<AuditResult["results"]> {
  const results: AuditResult["results"] = [];
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: projectRoot, absolute: true })) {
      if (!evaluatedFiles.has(file)) {
        results.push({
          contractId: "C-PROC04",
          contractDescription: "All source files must be in at least one contract scope",
          checkName: "file has contract coverage",
          status: "warn",
          message: "no contract evaluates this file",
          file,
        });
      }
    }
  }
  return results;
}

export async function runAudit(
  contracts: Contract[],
  trigger: ContractTrigger,
  projectRoot: string,
  coverage?: CoverageOptions
): Promise<AuditResult> {
  const allResults: AuditResult["results"] = [];
  const evaluatedFiles = new Set<string>();

  for (const contract of contracts) {
    const contractResults = await auditContract(contract, trigger, projectRoot);
    allResults.push(...contractResults);
    if (contract.trigger === trigger) {
      for (const r of contractResults) {
        if (r.file && r.file !== "__global__") evaluatedFiles.add(r.file);
      }
    }
  }

  if (coverage?.enabled && trigger === "commit") {
    allResults.push(...await checkCoverage(coverage.paths, evaluatedFiles, projectRoot));
  }

  return {
    results: allResults,
    passed: allResults.filter(r => r.status === "pass").length,
    failed: allResults.filter(r => r.status === "fail").length,
    exempt: allResults.filter(r => r.status === "exempt").length,
    skipped: allResults.filter(r => r.status === "skip").length,
    warned: allResults.filter(r => r.status === "warn").length,
  };
}
```

**Step 4: Update `src/init/config.ts` — add `coverage_paths` field**

```typescript
export interface ProjectConfig {
  project: string;
  github: { org: string; repo: string; runner: "github-hosted" | "self-hosted" };
  stack: Stack[];
  contracts: {
    audit_on: string[];
    behavioral_on: string[];
    require_coverage: boolean;
    coverage_paths?: string[];
  };
}
```

**Step 5: Update `src/commands/audit.ts` — pass coverage options to runAudit**

Add after loading stacks:

```typescript
import type { CoverageOptions } from "../engine/audit";

// after: stacks = cfg.stack ?? [];
let coverage: CoverageOptions | undefined;
if (existsSync(configPath)) {
  const cfg = yaml.load(readFileSync(configPath, "utf8")) as ProjectConfig;
  stacks = cfg.stack ?? [];
  if (cfg.contracts?.require_coverage !== false) {
    coverage = {
      enabled: true,
      paths: cfg.contracts?.coverage_paths ?? ["src/**/*", "lib/**/*", "app/**/*"],
    };
  }
}

// Change: const result = await runAudit(contracts, trigger, projectRoot);
// To:
const result = await runAudit(contracts, trigger, projectRoot, coverage);
```

**Step 6: Run tests — verify all pass**

```bash
bun test
```
Expected: all pass including 4 new C-PROC04 tests.

**Step 7: Commit**

```bash
git add src/engine/audit.ts src/init/config.ts src/commands/audit.ts tests/integration/audit.test.ts
git commit -m "feat(engine): C-PROC04 coverage check — warn on uncovered source files"
```

---

### Task 15: Final wiring, full test run, README update

**Step 1: Run full test suite**

```bash
bun test
```
Expected: all tests pass.

**Step 2: Update README**

Add to check modules table: `toml_key` already there. Add vault section, new commands to usage section.

In usage section, add:

```markdown
### `contract` — manage contracts

```bash
agent-config contract list                  # list all contracts
agent-config contract check C-PROC05        # run a single contract
agent-config contract new                   # scaffold a new contract interactively
```

### `spec` — manage RFCs

```bash
agent-config spec new                       # scaffold a new RFC
agent-config spec list                      # list all RFCs with status
agent-config spec status RFC-001            # show RFC lifecycle detail
```

### `vault` — manage encrypted secrets

```bash
agent-config vault init                     # initialise empty vault (requires .vault_password)
agent-config vault set API_KEY my-secret    # store a secret
agent-config vault get API_KEY              # retrieve a secret
agent-config vault list                     # list keys (no values)
agent-config vault export                   # print export statements for shell sourcing
```
```

**Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: update README with Phase 2 commands"
git push
```

**Step 4: Tag v0.2.0**

```bash
git tag v0.2.0
git push origin v0.2.0
```

---

## Done

Phase 2 complete when:
- [ ] `bun test` — all tests pass
- [ ] `agent-config contract list` — shows all contracts including new stacks
- [ ] `agent-config contract new` — interactively creates a valid YAML contract
- [ ] `agent-config spec new` + `spec list` + `spec status` — RFC workflow works end-to-end
- [ ] `agent-config vault init/set/get/export` — round-trip works with `.vault_password`
- [ ] `agent-config audit` on a project with `require_coverage: true` — warns on uncovered source files
- [ ] New stacks (Rails, Rust, Mobile, Containers) load via `loadBuiltinContracts(["rails"])` etc.
