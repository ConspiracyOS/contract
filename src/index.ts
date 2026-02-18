#!/usr/bin/env bun
import { Command } from "commander";
import { auditCommand } from "./commands/audit";
import { initCommand } from "./commands/init";
import { installCommand } from "./commands/install";
import { vaultGet, vaultSet, vaultList, vaultExport, vaultInit } from "./commands/vault";
import { contractList, contractCheck, contractNew } from "./commands/contract";
import { specNew, specList, specStatus } from "./commands/spec";

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

program
  .command("init")
  .description("Onboard a project with contracts, hooks, and CI")
  .action(async () => {
    await initCommand();
  });

program
  .command("install")
  .description("Re-install hooks and CI workflows (idempotent)")
  .action(async () => {
    await installCommand();
  });

const vault = program.command("vault").description("Manage encrypted project secrets");

vault.command("get <key>").description("Print a secret value").action(vaultGet);
vault.command("set <key> <value>").description("Store a secret value").action(vaultSet);
vault.command("list").description("List all secret keys (no values)").action(vaultList);
vault.command("export").description("Print export statements for shell sourcing").action(vaultExport);
vault.command("init").description("Initialise empty vault (requires .vault_password)").action(vaultInit);

const contractCmd = program.command("contract").description("Manage contracts");
contractCmd.command("list").description("List all contracts (builtins + project)").action(contractList);
contractCmd
  .command("check <id>")
  .description("Run a single contract by ID")
  .option("--trigger <trigger>", "Override trigger context")
  .action(contractCheck);
contractCmd.command("new").description("Scaffold a new contract interactively").action(contractNew);

const specCmd = program.command("spec").description("Manage RFCs");
specCmd.command("new").description("Scaffold a new RFC").action(specNew);
specCmd.command("list").description("List all RFCs with status").action(specList);
specCmd.command("status <id>").description("Show RFC lifecycle status").action(specStatus);

program.parse();
