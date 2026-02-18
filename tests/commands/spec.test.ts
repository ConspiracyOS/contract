// tests/commands/spec.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { scaffoldSpec, listSpecs, getSpecStatus } from "../../src/commands/spec";

const TMP = "/tmp/agent-config-spec-test";

beforeAll(() => mkdirSync(`${TMP}/.agent/specs`, { recursive: true }));
afterAll(() => rmSync(TMP, { recursive: true }));

describe("scaffoldSpec", () => {
  it("creates RFC directory with brief.md and proposal.md", () => {
    scaffoldSpec(TMP, "user-auth", "User authentication via JWT");
    expect(existsSync(`${TMP}/.agent/specs/RFC-001-user-auth/brief.md`)).toBe(true);
    expect(existsSync(`${TMP}/.agent/specs/RFC-001-user-auth/proposal.md`)).toBe(true);
  });

  it("auto-increments RFC number", () => {
    scaffoldSpec(TMP, "rate-limit", "API rate limiting");
    expect(existsSync(`${TMP}/.agent/specs/RFC-002-rate-limit/brief.md`)).toBe(true);
  });
});

describe("listSpecs", () => {
  it("returns specs with inferred status", () => {
    const specs = listSpecs(TMP);
    expect(specs).toHaveLength(2);
    expect(specs[0]!.status).toBe("draft");
  });
});

describe("getSpecStatus", () => {
  it("returns null for unknown RFC", () => {
    expect(getSpecStatus(TMP, "RFC-999")).toBeNull();
  });

  it("returns status for known RFC", () => {
    const status = getSpecStatus(TMP, "RFC-001");
    expect(status).not.toBeNull();
    expect(status!.status).toBe("draft");
    expect(status!.files.brief).toBe(true);
    expect(status!.files.proposal).toBe(true);
    expect(status!.files.approval).toBe(false);
  });
});
