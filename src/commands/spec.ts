// src/commands/spec.ts
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { input } from "@inquirer/prompts";

type SpecStatus = "draft" | "proposed" | "approved" | "implemented";

interface SpecInfo {
  id: string;
  slug: string;
  title: string;
  status: SpecStatus;
  dir: string;
}

interface SpecStatusDetail {
  id: string;
  status: SpecStatus;
  files: { brief: boolean; proposal: boolean; approval: boolean; review: boolean };
  nextAction: string;
}

function inferStatus(dir: string): SpecStatus {
  if (existsSync(`${dir}/review.md`)) return "implemented";
  if (existsSync(`${dir}/approval.md`)) return "approved";
  if (existsSync(`${dir}/proposal-submitted.md`)) return "proposed";
  return "draft";
}

function nextRfcNumber(specsDir: string): number {
  if (!existsSync(specsDir)) return 1;
  const dirs = readdirSync(specsDir).filter(d => /^RFC-\d+/.test(d));
  if (dirs.length === 0) return 1;
  const nums = dirs.map(d => parseInt(d.replace(/^RFC-(\d+).*/, "$1"), 10));
  return Math.max(...nums) + 1;
}

const BRIEF_STUB = (title: string) => `# ${title}

## Problem
<!-- What problem does this solve? -->

## Scope
<!-- What is in scope? What is explicitly out of scope? -->

## Success criteria
<!-- How will we know this is done? Be concrete. -->

## Contract coverage
<!-- Which existing contracts apply? Are new contracts needed? -->
- Applicable: (list contract IDs)
- New contracts required: (or "none")
`;

const PROPOSAL_STUB = (title: string) => `# ${title} — Proposal

## Approach
<!-- Describe the implementation approach. -->

## Acceptance criteria

> Each criterion must include a concrete example: specific inputs → expected outputs.

- [ ] **Criterion 1**: When ___ happens, ___ should occur. Example: given ___, expect ___.

## Implementation notes
<!-- Architecture decisions, dependencies, risks. -->
`;

export function scaffoldSpec(projectRoot: string, slug: string, title: string): string {
  const specsDir = `${projectRoot}/.agent/specs`;
  const num = String(nextRfcNumber(specsDir)).padStart(3, "0");
  const id = `RFC-${num}`;
  const dir = `${specsDir}/${id}-${slug}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/brief.md`, BRIEF_STUB(title));
  writeFileSync(`${dir}/proposal.md`, PROPOSAL_STUB(title));
  return dir;
}

export function listSpecs(projectRoot: string): SpecInfo[] {
  const specsDir = `${projectRoot}/.agent/specs`;
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir)
    .filter(d => /^RFC-\d+/.test(d))
    .sort()
    .map(d => {
      const dir = `${specsDir}/${d}`;
      const match = d.match(/^(RFC-\d+)-(.+)$/);
      return {
        id: match?.[1] ?? d,
        slug: match?.[2] ?? d,
        title: match?.[2]?.replace(/-/g, " ") ?? d,
        status: inferStatus(dir),
        dir,
      };
    });
}

export function getSpecStatus(projectRoot: string, rfcId: string): SpecStatusDetail | null {
  const specsDir = `${projectRoot}/.agent/specs`;
  if (!existsSync(specsDir)) return null;
  const dir = readdirSync(specsDir).find(d => d.startsWith(rfcId + "-") || d === rfcId);
  if (!dir) return null;
  const fullDir = `${specsDir}/${dir}`;
  const files = {
    brief: existsSync(`${fullDir}/brief.md`),
    proposal: existsSync(`${fullDir}/proposal.md`),
    approval: existsSync(`${fullDir}/approval.md`),
    review: existsSync(`${fullDir}/review.md`),
  };
  const status = inferStatus(fullDir);
  const nextAction =
    !files.brief ? "Create brief.md" :
    !files.proposal ? "Draft proposal.md" :
    !files.approval ? "Awaiting approval.md from owner" :
    !files.review ? "Add review.md with implementation evidence" :
    "RFC complete";
  return { id: rfcId, status, files, nextAction };
}

export async function specNew(): Promise<void> {
  const root = process.cwd();
  console.log("\nagent-config spec new\n");
  const title = await input({ message: "RFC title:" });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dir = scaffoldSpec(root, slug, title);
  const rfcId = dir.split("/").pop()!.match(/^(RFC-\d+)/)?.[1];
  console.log(`\n${rfcId} scaffolded at .agent/specs/${dir.split("/").pop()}`);
  console.log("  Next: fill in brief.md, then draft proposal.md\n");
}

export function specList(): void {
  const root = process.cwd();
  const specs = listSpecs(root);
  if (specs.length === 0) { console.log("No RFCs found."); return; }
  console.log("\n" + "ID".padEnd(10) + "STATUS".padEnd(14) + "TITLE");
  console.log("-".repeat(60));
  for (const s of specs) {
    console.log(s.id.padEnd(10) + s.status.padEnd(14) + s.title);
  }
  console.log(`\n${specs.length} RFC(s)\n`);
}

export function specStatus(id: string): void {
  const root = process.cwd();
  const detail = getSpecStatus(root, id);
  if (!detail) { console.error(`RFC "${id}" not found.`); process.exit(1); }
  console.log(`\n${detail.id} — ${detail.status.toUpperCase()}`);
  console.log(`  brief.md:    ${detail.files.brief ? "yes" : "no"}`);
  console.log(`  proposal.md: ${detail.files.proposal ? "yes" : "no"}`);
  console.log(`  approval.md: ${detail.files.approval ? "yes" : "no"}`);
  console.log(`  review.md:   ${detail.files.review ? "yes" : "no"}`);
  console.log(`\nNext action: ${detail.nextAction}\n`);
}
