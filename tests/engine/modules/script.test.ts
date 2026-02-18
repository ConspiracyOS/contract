// tests/engine/modules/script.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { runScriptCheck } from "../../../src/engine/modules/script";
import { mkdirSync, writeFileSync, rmSync, chmodSync } from "fs";

const TMP = "/tmp/agent-config-test-script";

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });

  writeFileSync(`${TMP}/pass.sh`, `#!/usr/bin/env bash\necho "PASS: all good"\nexit 0\n`);
  chmodSync(`${TMP}/pass.sh`, 0o755);

  writeFileSync(`${TMP}/fail.sh`, `#!/usr/bin/env bash\necho "FAIL: broken: reason here"\nexit 1\n`);
  chmodSync(`${TMP}/fail.sh`, 0o755);
});
afterAll(() => rmSync(TMP, { recursive: true }));

describe("runScriptCheck", () => {
  it("returns pass for exit 0 with PASS: prefix", async () => {
    const result = await runScriptCheck(`${TMP}/pass.sh`, TMP);
    expect(result.pass).toBe(true);
    expect(result.message).toMatch(/PASS:/);
  });

  it("returns fail for exit 1 with FAIL: prefix", async () => {
    const result = await runScriptCheck(`${TMP}/fail.sh`, TMP);
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/FAIL:/);
  });
});
