// src/engine/modules/dependency-cruiser.ts
import type { Finding, ModuleResult } from "../types";
import { GLOBAL_SCOPE_SENTINEL } from "../scope";

interface DepCruiserViolation {
  type: string;
  from: string;
  to: string;
  rule: { name: string; severity: string };
  cycle?: string[];
}

interface DepCruiserOutput {
  summary: {
    violations: DepCruiserViolation[];
  };
}

function mapSeverity(severity: string): "error" | "warning" | "info" | null {
  if (severity === "ignore") return null;
  if (severity === "warn") return "warning";
  if (severity === "error" || severity === "warning" || severity === "info") {
    return severity;
  }
  return "info";
}

export function parseDepCruiserOutput(stdout: string): Finding[] {
  const output: DepCruiserOutput = JSON.parse(stdout);
  const findings: Finding[] = [];

  for (const v of output.summary.violations) {
    const severity = mapSeverity(v.rule.severity);
    if (severity === null) continue;

    let message = `${v.from} \u2192 ${v.to}`;
    if (v.cycle && v.cycle.length > 0) {
      message += ` (circular: ${v.cycle.join(" \u2192 ")})`;
    }

    findings.push({
      ruleId: v.rule.name,
      message,
      severity,
      file: v.from,
    });
  }

  return findings;
}

interface DepCruiserCheckOptions {
  config: string;
}

export async function runDepCruiserCheck(
  options: DepCruiserCheckOptions,
  file: string,
  projectRoot: string
): Promise<ModuleResult> {
  const configPath = `${projectRoot}/${options.config}`;
  const scanTarget = file === GLOBAL_SCOPE_SENTINEL ? projectRoot : file;

  const proc = Bun.spawnSync(
    ["npx", "depcruise", "--output-type", "json", "--config", configPath, scanTarget],
    {
      cwd: projectRoot,
      stderr: "pipe",
    }
  );

  // Tool not found
  if (proc.exitCode === null) {
    return {
      pass: false,
      reason: "depcruise (dependency-cruiser) is not installed or not found in PATH",
    };
  }

  const stdout = new TextDecoder().decode(proc.stdout);

  // Empty stdout = error
  if (!stdout.trim()) {
    return { pass: false, reason: "depcruise produced no output" };
  }

  try {
    const findings = parseDepCruiserOutput(stdout);
    return { pass: findings.length === 0, findings };
  } catch (e) {
    return { pass: false, reason: `failed to parse depcruise output: ${e}` };
  }
}
