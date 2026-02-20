// src/engine/modules/import-linter.ts
import type { Finding, ModuleResult } from "../types";

/**
 * Convert a Python module path (dot-separated) to a file path.
 * e.g., "mypackage.foo" -> "mypackage/foo.py"
 */
export function modulePathToFilePath(modulePath: string): string {
  return modulePath.replace(/\./g, "/") + ".py";
}

/**
 * Parse import-linter text output into findings.
 *
 * import-linter has no JSON mode, so we parse the text output using a state machine.
 * The relevant section starts after "Broken contracts" header. Within it:
 * - Non-indented, non-separator, non-description lines = contract name
 * - Indented lines matching /^\s+(\S+):(\d+):\s+(.+)$/ = violation lines
 */
export function parseImportLinterOutput(stdout: string): Finding[] {
  if (!stdout.trim()) return [];

  const lines = stdout.split("\n");
  const findings: Finding[] = [];

  // Find the "Broken contracts" section
  let inBrokenSection = false;
  let currentContract: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect the "Broken contracts" header
    if (line.trim() === "Broken contracts") {
      inBrokenSection = true;
      // Skip the separator line(s) after the header
      continue;
    }

    if (!inBrokenSection) continue;

    // Skip separator lines (all dashes) and empty lines
    if (/^-+$/.test(line.trim()) || line.trim() === "") continue;

    // Try to match violation lines (indented: module:line: import statement)
    const violationMatch = line.match(/^\s+(\S+):(\d+):\s+(.+)$/);
    if (violationMatch) {
      const [, modulePath, lineNum, importStatement] = violationMatch;
      if (currentContract) {
        findings.push({
          ruleId: currentContract,
          message: importStatement,
          severity: "error",
          file: modulePathToFilePath(modulePath),
          line: parseInt(lineNum, 10),
        });
      }
      continue;
    }

    // Skip description lines (e.g., "mypackage.foo is not allowed to import ...")
    if (line.match(/is not allowed to import/)) continue;

    // Non-indented, non-separator text = contract name
    const trimmed = line.trim();
    if (trimmed && !line.startsWith(" ") && !line.startsWith("\t")) {
      currentContract = trimmed;
    }
  }

  return findings;
}

interface ImportLinterCheckOptions {
  config?: string;
}

export async function runImportLinterCheck(
  options: ImportLinterCheckOptions,
  projectRoot: string
): Promise<ModuleResult> {
  const cmd: string[] = ["lint-imports"];

  if (options.config) {
    cmd.push("--config", `${projectRoot}/${options.config}`);
  }

  const proc = Bun.spawnSync(cmd, {
    cwd: projectRoot,
    stderr: "pipe",
  });

  // Tool not found
  if (proc.exitCode === null) {
    return {
      pass: false,
      reason: "lint-imports (import-linter) is not installed or not found in PATH",
    };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  // Exit code 0 = all contracts kept
  if (proc.exitCode === 0) {
    return { pass: true, findings: [] };
  }

  // Non-zero = at least one broken contract, parse stdout for findings
  const findings = parseImportLinterOutput(stdout);
  return { pass: false, findings };
}
