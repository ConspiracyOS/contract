// tests/engine/scope.test.ts
import { describe, it, expect } from "bun:test";
import { resolveScope } from "../../src/engine/scope";
import type { ContractScope } from "../../src/engine/types";

describe("resolveScope", () => {
  it("returns empty array for global scope with no files", async () => {
    // global scope means the contract applies once, not per-file
    const files = await resolveScope("global", "/tmp");
    expect(files).toEqual(["__global__"]);
  });

  it("matches files by glob pattern", async () => {
    const scope: ContractScope = { paths: ["**/*.ts"] };
    const files = await resolveScope(scope, import.meta.dir + "/../../src");
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.endsWith(".ts"))).toBe(true);
  });

  it("excludes files matching exclude patterns", async () => {
    const scope: ContractScope = {
      paths: ["**/*.ts"],
      exclude: ["**/types.ts"],
    };
    const files = await resolveScope(scope, import.meta.dir + "/../../src");
    expect(files.some(f => f.endsWith("types.ts"))).toBe(false);
  });
});
