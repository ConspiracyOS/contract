// src/engine/scope.ts
import { Glob } from "bun";
import micromatch from "micromatch";
import type { ContractScope } from "./types";

export const GLOBAL_SCOPE_SENTINEL = "__global__";

export async function resolveScope(
  scope: ContractScope | "global",
  projectRoot: string
): Promise<string[]> {
  if (scope === "global") return [GLOBAL_SCOPE_SENTINEL];

  const patterns = scope.paths ?? ["**/*"];
  const excludes = scope.exclude ?? [];

  const files: string[] = [];
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: projectRoot, absolute: true })) {
      files.push(file);
    }
  }

  if (excludes.length === 0) return [...new Set(files)];

  return [...new Set(files)].filter(
    f => !micromatch([f], excludes, { matchBase: true }).length
  );
}
