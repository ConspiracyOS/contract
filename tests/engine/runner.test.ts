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
});
