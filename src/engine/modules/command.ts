// src/engine/modules/command.ts
interface CommandCheckOptions {
  run: string;
  exit_code?: number;
  output_matches?: string;
}

interface CommandCheckResult {
  pass: boolean;
  reason?: string;
}

export async function runCommandCheck(
  options: CommandCheckOptions,
  cwd?: string
): Promise<CommandCheckResult> {
  const proc = Bun.spawnSync(["sh", "-c", options.run], {
    cwd,
    stderr: "pipe",
  });

  const expectedExit = options.exit_code ?? 0;
  if (proc.exitCode !== expectedExit) {
    return {
      pass: false,
      reason: `exit code ${proc.exitCode} (expected ${expectedExit})`,
    };
  }

  if (options.output_matches) {
    const stdout = new TextDecoder().decode(proc.stdout);
    if (!new RegExp(options.output_matches).test(stdout)) {
      return {
        pass: false,
        reason: `output did not match /${options.output_matches}/`,
      };
    }
  }

  return { pass: true };
}
