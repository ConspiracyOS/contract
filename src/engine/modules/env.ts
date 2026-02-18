// src/engine/modules/env.ts
export async function checkEnvVar(
  name: string,
  options?: { equals?: string; matches?: string }
): Promise<boolean> {
  const value = process.env[name];
  if (value === undefined) return false;
  if (!options) return true;
  if (options.equals !== undefined) return value === options.equals;
  if (options.matches !== undefined) return new RegExp(options.matches).test(value);
  return true;
}

export async function checkNoEnvVar(name: string, matchPattern?: string): Promise<boolean> {
  const value = process.env[name];
  if (value === undefined) return true;
  if (matchPattern) return !new RegExp(matchPattern).test(value);
  return false;
}

export async function checkCommandAvailable(name: string): Promise<boolean> {
  const result = Bun.spawnSync(["which", name], { stderr: "ignore" });
  return result.exitCode === 0;
}
