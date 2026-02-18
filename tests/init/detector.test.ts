// tests/init/detector.test.ts
import { describe, it, expect, afterAll } from "bun:test";
import { detectStacks } from "../../src/init/detector";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const TMP = "/tmp/agent-config-test-detector";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("detectStacks", () => {
  it("detects TypeScript project", async () => {
    const dir = `${TMP}/ts`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/package.json`, JSON.stringify({ name: "test" }));
    writeFileSync(`${dir}/tsconfig.json`, "{}");
    expect(await detectStacks(dir)).toContain("typescript");
  });

  it("detects Python project", async () => {
    const dir = `${TMP}/py`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/pyproject.toml`, "[project]\nname = \"test\"\n");
    expect(await detectStacks(dir)).toContain("python");
  });

  it("detects Elixir project", async () => {
    const dir = `${TMP}/ex`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/mix.exs`, "defmodule Test.MixProject do\nend\n");
    expect(await detectStacks(dir)).toContain("elixir");
  });

  it("detects containers", async () => {
    const dir = `${TMP}/docker`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/docker-compose.yml`, "services:\n  app:\n    image: node\n");
    expect(await detectStacks(dir)).toContain("containers");
  });

  it("returns empty array for bare directory", async () => {
    const dir = `${TMP}/empty`;
    mkdirSync(dir, { recursive: true });
    expect(await detectStacks(dir)).toEqual([]);
  });
});
