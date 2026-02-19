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

  it("does not detect TypeScript from package.json alone", async () => {
    const dir = `${TMP}/ts-false-positive`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/package.json`, JSON.stringify({ name: "test" }));
    expect(await detectStacks(dir)).not.toContain("typescript");
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

  it("detects shell stack when scripts/ dir exists", async () => {
    const dir = `${TMP}/shell`;
    mkdirSync(`${dir}/scripts`, { recursive: true });
    writeFileSync(`${dir}/scripts/deploy.sh`, "#!/bin/bash\necho hi\n");
    expect(await detectStacks(dir)).toContain("shell");
  });

  it("does not detect Rails from Gemfile alone", async () => {
    const dir = `${TMP}/rails-false-positive`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/Gemfile`, 'source "https://rubygems.org"\n');
    expect(await detectStacks(dir)).not.toContain("rails");
  });

  it("detects JavaScript project from package.json without tsconfig", async () => {
    const dir = `${TMP}/js`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/package.json`, JSON.stringify({ name: "js-only" }));
    expect(await detectStacks(dir)).toContain("javascript");
  });

  it("does not detect JavaScript when tsconfig is present", async () => {
    const dir = `${TMP}/js-ts-overlap`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/package.json`, JSON.stringify({ name: "ts-project" }));
    writeFileSync(`${dir}/tsconfig.json`, "{}");
    expect(await detectStacks(dir)).not.toContain("javascript");
  });

  it("detects Go project", async () => {
    const dir = `${TMP}/go`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/go.mod`, "module example.com/test\n\ngo 1.23\n");
    expect(await detectStacks(dir)).toContain("go");
  });

  it("returns empty array for bare directory", async () => {
    const dir = `${TMP}/empty`;
    mkdirSync(dir, { recursive: true });
    expect(await detectStacks(dir)).toEqual([]);
  });
});
