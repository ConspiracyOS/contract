// src/builtins/index.ts
import { PROC_CONTRACTS } from "./proc";
import { parseContract } from "../engine/parser";
import type { Contract } from "../engine/types";

export function loadBuiltinContracts(): Contract[] {
  return [...PROC_CONTRACTS].map(yaml => parseContract(yaml));
}
