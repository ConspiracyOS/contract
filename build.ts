import { $ } from "bun";

await $`bun build src/index.ts --compile --outfile dist/agent-config --target bun`;
console.log("Built: dist/agent-config");
