// src/engine/modules/script.ts
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface ScriptResult {
  pass: boolean;
  message?: string;
}

export async function runScriptCheck(
  scriptPath: string,
  cwd: string,
  timeoutMs = 60_000
): Promise<ScriptResult> {
  const proc = Bun.spawnSync([scriptPath], {
    cwd,
    stderr: "pipe",
    timeout: timeoutMs,
  });

  const output = new TextDecoder().decode(proc.stdout).trim();
  return {
    pass: proc.exitCode === 0,
    message: output || new TextDecoder().decode(proc.stderr).trim(),
  };
}

export async function runInlineScriptCheck(
  scriptContent: string,
  cwd: string,
  timeoutMs = 60_000
): Promise<ScriptResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), "agent-config-script-"));
  const tmpScript = join(tmpDir, "check.sh");
  try {
    writeFileSync(tmpScript, scriptContent, { mode: 0o755 });
    chmodSync(tmpScript, 0o755);
    return await runScriptCheck(tmpScript, cwd, timeoutMs);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
