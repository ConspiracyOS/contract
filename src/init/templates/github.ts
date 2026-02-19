// src/init/templates/github.ts
import type { ProjectConfig } from "../config";

export function generateCODEOWNERS(config: ProjectConfig): string {
  return `# agent-config: independence guarantee
# Contract files and RFC approvals require owner review before merge.
.agent/contracts/ @${config.github.org}
.agent/specs/*/approval.md @${config.github.org}
`;
}

export function generatePRTemplate(): string {
  return `## Summary
<!-- What does this PR do? -->

## RFC
<!-- RFC-NNN or N/A with reason -->

## Issue
<!-- Closes #N -->

## Evidence
<!-- CI link, test output, scenario results -->

## Contract coverage
<!-- List applicable contracts; confirm audit passes -->

## Risk
<!-- low | medium | high — one-line justification -->
`;
}

export function generateCIWorkflow(config: ProjectConfig): string {
  const runner = config.github.runner === "self-hosted" ? "self-hosted" : "ubuntu-latest";
  return `name: CI

on:
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ${runner}
    steps:
      - uses: actions/checkout@v4
      - name: Install agent-config
        run: |
          curl -fsSL https://github.com/vegardkrogh/agent-config-cli/releases/latest/download/agent-config-linux-x64 -o /usr/local/bin/agent-config
          chmod +x /usr/local/bin/agent-config
      - name: Run contract audit
        run: agent-config audit --trigger pr
`;
}

export function generatePostMergeWorkflow(config: ProjectConfig): string {
  const runner = config.github.runner === "self-hosted" ? "self-hosted" : "ubuntu-latest";
  return `name: Post-merge

on:
  push:
    branches: [main]

jobs:
  behavioral-contracts:
    runs-on: ${runner}
    steps:
      - uses: actions/checkout@v4
      - name: Install agent-config
        run: |
          curl -fsSL https://github.com/vegardkrogh/agent-config-cli/releases/latest/download/agent-config-linux-x64 -o /usr/local/bin/agent-config
          chmod +x /usr/local/bin/agent-config
      - name: Run behavioral contracts
        run: agent-config audit --trigger merge
        continue-on-error: true
`;
}

export function generateFeatureIssueTemplate(): string {
  return `---
name: Feature
about: New feature or enhancement
labels: feature
---

## Problem
<!-- What problem does this solve? -->

## Proposed solution
<!-- Brief description -->

## RFC
<!-- Will this require an RFC? Link if exists. -->
`;
}

export function generateBugIssueTemplate(): string {
  return `---
name: Bug
about: Something is broken
labels: bug
---

## Description
<!-- What is broken? -->

## Steps to reproduce
1.
2.

## Expected vs actual
<!-- What should happen vs what happens -->

## Contract
<!-- Which contract does this violate, if any? -->
`;
}
