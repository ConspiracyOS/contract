// src/engine/modules/ast-grep.ts
import type { Finding, ModuleResult } from "../types";
import { GLOBAL_SCOPE_SENTINEL } from "../scope";

interface AstGrepMatch {
  ruleId: string;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  file: string;
  range: {
    start: { line: number; column: number }; // 0-based
    end: { line: number; column: number };   // 0-based
  };
}

export function parseAstGrepOutput(stdout: string): Finding[] {
  const matches: AstGrepMatch[] = JSON.parse(stdout);
  return matches.map((m) => ({
    ruleId: m.ruleId,
    message: m.message,
    severity: m.severity === "hint" ? "info" : m.severity,
    file: m.file,
    line: m.range.start.line + 1,
    column: m.range.start.column + 1,
    endLine: m.range.end.line + 1,
    endColumn: m.range.end.column + 1,
  }));
}

interface AstGrepCheckOptions {
  rule: string;
}

export async function runAstGrepCheck(
  options: AstGrepCheckOptions,
  file: string,
  projectRoot: string
): Promise<ModuleResult> {
  const rulePath = `${projectRoot}/${options.rule}`;
  const scanTarget = file === GLOBAL_SCOPE_SENTINEL ? projectRoot : file;

  const proc = Bun.spawnSync(["sg", "scan", "--json", "--rule", rulePath, scanTarget], {
    cwd: projectRoot,
    stderr: "pipe",
  });

  // Tool not found
  if (proc.exitCode === null) {
    return { pass: false, reason: "sg (ast-grep) is not installed or not found in PATH" };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  // Exit code 0 = no matches (pass), 1 = matches found (fail with findings)
  if (proc.exitCode === 0 || proc.exitCode === 1) {
    try {
      const findings = stdout.trim() ? parseAstGrepOutput(stdout) : [];
      return { pass: findings.length === 0, findings };
    } catch (e) {
      return { pass: false, reason: `failed to parse sg output: ${e}` };
    }
  }

  // Other exit codes = error
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  return { pass: false, reason: `sg exited with code ${proc.exitCode}: ${stderr}` };
}
