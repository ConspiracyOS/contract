// src/engine/parser.ts
import yaml from "js-yaml";
import { z } from "zod";
import type { Contract } from "./types";

const SkipIfSchema = z.object({
  env_var_unset: z.string().optional(),
  path_not_exists: z.string().optional(),
  not_in_ci: z.boolean().optional(),
}).optional();

const CheckSchema = z.object({
  name: z.string(),
  on_fail: z.enum(["fail", "require_exemption", "warn"]).optional(),
  skip_if: SkipIfSchema,
}).passthrough();

const ScopeSchema = z.union([
  z.literal("global"),
  z.object({
    paths: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
  }),
]);

const ContractSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(["atomic", "holistic"]),
  trigger: z.enum(["commit", "pr", "merge", "schedule"]),
  scope: ScopeSchema,
  checks: z.array(CheckSchema),
});

export function parseContract(rawYaml: string): Contract {
  const parsed = yaml.load(rawYaml);
  const result = ContractSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid contract: ${result.error.message}`);
  }
  return result.data as Contract;
}

export function parseContractFile(path: string): Contract {
  const content = Bun.file(path).textSync();
  return parseContract(content);
}
