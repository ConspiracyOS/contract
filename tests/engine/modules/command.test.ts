// tests/engine/modules/command.test.ts
import { describe, it, expect } from "bun:test";
import { runCommandCheck } from "../../../src/engine/modules/command";

describe("runCommandCheck", () => {
  it("passes when exit code matches", async () => {
    const result = await runCommandCheck({ run: "echo hello", exit_code: 0 });
    expect(result.pass).toBe(true);
  });

  it("fails when exit code does not match", async () => {
    const result = await runCommandCheck({ run: "exit 1", exit_code: 0 });
    expect(result.pass).toBe(false);
  });

  it("passes when output matches pattern", async () => {
    const result = await runCommandCheck({
      run: "echo hello-world",
      exit_code: 0,
      output_matches: "hello",
    });
    expect(result.pass).toBe(true);
  });

  it("fails when output does not match pattern", async () => {
    const result = await runCommandCheck({
      run: "echo goodbye",
      exit_code: 0,
      output_matches: "hello",
    });
    expect(result.pass).toBe(false);
  });

  it("returns false (not a crash) when output_matches is an invalid regex", async () => {
    const result = await runCommandCheck({
      run: "echo hello",
      exit_code: 0,
      output_matches: "[invalid(",
    });
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("invalid regex");
  });
});
