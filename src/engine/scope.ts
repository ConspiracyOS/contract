// src/engine/scope.ts
import { Glob } from "bun";
import { spawnSync } from "child_process";
import micromatch from "micromatch";
import type { ContractScope } from "./types";

export const GLOBAL_SCOPE_SENTINEL = "__global__";

function getTrackedFiles(projectRoot: string): string[] | null {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024, // 50MB for large repos
    }
  );
  if (result.status !== 0 || result.error) return null;
  const files = result.stdout.split("\n").filter(Boolean);
  // If git returned nothing (non-git dir or empty repo), signal fallback
  return files;
}

let cachedFiles: string[] | null = null;
let cachedRoot: string | null = null;

function clearFileCache(): void {
  cachedFiles = null;
  cachedRoot = null;
}

// Exported for testing
export { clearFileCache };

async function getFiles(projectRoot: string): Promise<{ files: string[]; relative: boolean }> {
  if (cachedRoot === projectRoot && cachedFiles !== null) {
    return { files: cachedFiles, relative: true };
  }

  const gitFiles = getTrackedFiles(projectRoot);
  if (gitFiles !== null && gitFiles.length > 0) {
    cachedFiles = gitFiles;
    cachedRoot = projectRoot;
    return { files: gitFiles, relative: true };
  }

  // Fallback: use Glob for non-git directories (e.g., test temp dirs)
  const allFiles: string[] = [];
  const glob = new Glob("**/*");
  for await (const file of glob.scan({ cwd: projectRoot, absolute: false, onlyFiles: true })) {
    allFiles.push(file);
  }
  // Do not cache glob results (only used in non-git/test contexts)
  return { files: allFiles, relative: true };
}

export async function resolveScope(
  scope: ContractScope | "global",
  projectRoot: string
): Promise<string[]> {
  if (scope === "global") return [GLOBAL_SCOPE_SENTINEL];

  const patterns = scope.paths ?? ["**/*"];
  const excludes = scope.exclude ?? [];

  const { files } = await getFiles(projectRoot);

  let matched = micromatch(files, patterns);

  if (excludes.length > 0) {
    matched = matched.filter(f => !micromatch.isMatch(f, excludes));
  }

  // Return absolute paths
  return [...new Set(matched.map(f => `${projectRoot}/${f}`))];
}
