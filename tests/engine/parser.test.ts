// tests/engine/parser.test.ts
import { describe, it, expect } from "bun:test";
import { parseContract } from "../../src/engine/parser";

describe("parseContract", () => {
  it("parses a minimal valid contract", () => {
    const yaml = `
id: C-001
description: Test contract
type: atomic
trigger: commit
scope: global
checks:
  - name: check something
    path_exists:
      path: ".agent"
    on_fail: fail
`;
    const contract = parseContract(yaml);
    expect(contract.id).toBe("C-001");
    expect(contract.trigger).toBe("commit");
    expect(contract.checks).toHaveLength(1);
    expect(contract.checks[0]!.name).toBe("check something");
  });

  it("throws on missing required field", () => {
    const yaml = `description: Missing id`;
    expect(() => parseContract(yaml)).toThrow();
  });

  it("parses scope with paths and excludes", () => {
    const yaml = `
id: C-002
description: Scoped
type: atomic
trigger: pr
scope:
  paths: ["**/*.ts"]
  exclude: ["**/node_modules/**"]
checks:
  - name: check
    path_exists:
      path: "src"
    on_fail: warn
`;
    const contract = parseContract(yaml);
    expect(contract.scope).toEqual({
      paths: ["**/*.ts"],
      exclude: ["**/node_modules/**"],
    });
  });
});
