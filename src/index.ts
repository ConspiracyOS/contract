#!/usr/bin/env bun
import { Command } from "commander";
import { auditCommand } from "./commands/audit";

const program = new Command();

program
  .name("agent-config")
  .description("Enforce methodology on AI agent projects")
  .version("0.1.0");

program
  .command("audit")
  .description("Run all applicable contracts")
  .option("--trigger <trigger>", "Trigger context: commit | pr | merge", "commit")
  .option("--no-builtins", "Skip built-in process contracts")
  .action(async (options) => {
    await auditCommand({ trigger: options.trigger, noBuiltins: !options.builtins });
  });

program.parse();
