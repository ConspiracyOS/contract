// src/builtins/index.ts
import { PROC_CONTRACTS } from "./proc";
import { TS_CONTRACTS } from "../stacks/typescript";
import { PY_CONTRACTS } from "../stacks/python";
import { EX_CONTRACTS } from "../stacks/elixir";
import { RB_CONTRACTS } from "../stacks/rails";
import { RS_CONTRACTS } from "../stacks/rust";
import { MO_CONTRACTS } from "../stacks/mobile";
import { CT_CONTRACTS } from "../stacks/containers";
import { parseContract } from "../engine/parser";
import type { Contract } from "../engine/types";
import type { Stack } from "../init/detector";

export function loadBuiltinContracts(stacks: Stack[] = []): Contract[] {
  const yamls = [...PROC_CONTRACTS];
  if (stacks.includes("typescript")) yamls.push(...TS_CONTRACTS);
  if (stacks.includes("python")) yamls.push(...PY_CONTRACTS);
  if (stacks.includes("elixir")) yamls.push(...EX_CONTRACTS);
  if (stacks.includes("rails")) yamls.push(...RB_CONTRACTS);
  if (stacks.includes("rust")) yamls.push(...RS_CONTRACTS);
  if (stacks.includes("mobile")) yamls.push(...MO_CONTRACTS);
  if (stacks.includes("containers")) yamls.push(...CT_CONTRACTS);
  return yamls.map(y => parseContract(y));
}
