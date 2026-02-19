// src/init/detector.ts
import { existsSync } from "fs";

export type Stack =
  | "typescript"
  | "javascript"
  | "python"
  | "elixir"
  | "rust"
  | "rails"
  | "mobile"
  | "containers"
  | "shell"
  | "go";

type StackRule = {
  stack: Stack;
  anyOf?: string[];
  allOf?: string[];
  noneOf?: string[];
};

const STACK_RULES: StackRule[] = [
  { stack: "typescript", allOf: ["tsconfig.json"] },
  { stack: "javascript", allOf: ["package.json"], noneOf: ["tsconfig.json"] },
  { stack: "python", anyOf: ["pyproject.toml", "requirements.txt", "setup.py"] },
  { stack: "elixir", allOf: ["mix.exs"] },
  { stack: "rust", allOf: ["Cargo.toml"] },
  { stack: "rails", allOf: ["config/application.rb"] },
  { stack: "mobile", anyOf: ["app.json", "expo.json"] },
  { stack: "containers", anyOf: ["docker-compose.yml", "docker-compose.yaml", "compose.yml"] },
  { stack: "shell", allOf: ["scripts"] },
  { stack: "go", allOf: ["go.mod"] },
];

export async function detectStacks(projectRoot: string): Promise<Stack[]> {
  const detected: Stack[] = [];
  for (const { stack, anyOf, allOf, noneOf } of STACK_RULES) {
    const anyMatch = !anyOf || anyOf.some(f => existsSync(`${projectRoot}/${f}`));
    const allMatch = !allOf || allOf.every(f => existsSync(`${projectRoot}/${f}`));
    const noneMatch = !noneOf || noneOf.every(f => !existsSync(`${projectRoot}/${f}`));
    if (anyMatch && allMatch && noneMatch) {
      detected.push(stack);
    }
  }
  return detected;
}
