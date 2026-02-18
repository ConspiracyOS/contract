#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command();

program
  .name("agent-config")
  .description("Enforce methodology on AI agent projects")
  .version("0.1.0");

program.parse();
