// tests/engine/runner.test.ts
import { describe, it, expect } from "bun:test";
import { evaluateSkipIf, runCheck } from "../../src/engine/runner";

describe("evaluateSkipIf", () => {
  it("returns false (do not skip) when no conditions", () => {
    expect(evaluateSkipIf(undefined, "/tmp")).toBe(false);
  });

  it("skips when env var is unset", () => {
    delete process.env.__SKIP_TEST_VAR;
    expect(evaluateSkipIf({ env_var_unset: "__SKIP_TEST_VAR" }, "/tmp")).toBe(true);
  });

  it("does not skip when env var is set", () => {
    process.env.__SKIP_TEST_VAR = "1";
    expect(evaluateSkipIf({ env_var_unset: "__SKIP_TEST_VAR" }, "/tmp")).toBe(false);
    delete process.env.__SKIP_TEST_VAR;
  });

  it("skips in non-CI when not_in_ci is true", () => {
    const wasCI = process.env.CI;
    delete process.env.CI;
    expect(evaluateSkipIf({ not_in_ci: true }, "/tmp")).toBe(true);
    if (wasCI) process.env.CI = wasCI;
  });

  it("skips when path_not_exists is resolved relative to projectRoot", () => {
    // /tmp exists, so path_not_exists: "tmp" with projectRoot="/nonexistent" should skip
    expect(evaluateSkipIf({ path_not_exists: "definitely-not-here" }, "/tmp")).toBe(true);
    // /tmp/nonexistent-dir does not exist — should skip
    expect(evaluateSkipIf({ path_not_exists: "nonexistent-dir" }, "/tmp")).toBe(true);
    // /tmp itself exists — should NOT skip
    expect(evaluateSkipIf({ path_not_exists: "" }, "/tmp")).toBe(false);
  });

  it("skips when command_not_available refers to a non-existent command", () => {
    expect(evaluateSkipIf({ command_not_available: "definitely-not-a-real-command-xyz" }, "/tmp")).toBe(true);
  });

  it("does not skip when command_not_available refers to an available command", () => {
    // 'sh' is always available
    expect(evaluateSkipIf({ command_not_available: "sh" }, "/tmp")).toBe(false);
  });
});
