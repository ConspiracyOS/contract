// src/engine/modules/script.ts
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
