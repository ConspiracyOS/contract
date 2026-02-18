// src/init/detector.ts
import { existsSync } from "fs";

export type Stack = "typescript" | "python" | "elixir" | "rust" | "rails" | "mobile" | "containers";

const STACK_SIGNALS: Array<{ stack: Stack; files: string[] }> = [
  { stack: "typescript", files: ["tsconfig.json", "package.json"] },
  { stack: "python", files: ["pyproject.toml", "requirements.txt", "setup.py"] },
  { stack: "elixir", files: ["mix.exs"] },
  { stack: "rust", files: ["Cargo.toml"] },
  { stack: "rails", files: ["Gemfile", "config/application.rb"] },
  { stack: "mobile", files: ["app.json", "expo.json"] },
  { stack: "containers", files: ["docker-compose.yml", "docker-compose.yaml", "compose.yml"] },
];

export async function detectStacks(projectRoot: string): Promise<Stack[]> {
  const detected: Stack[] = [];
  for (const { stack, files } of STACK_SIGNALS) {
    if (files.some(f => existsSync(`${projectRoot}/${f}`))) {
      detected.push(stack);
    }
  }
  return detected;
}
