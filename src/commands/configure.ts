// src/commands/configure.ts
export function configureCommand(): void {
  console.log(`
agent-config configure

Paste the following prompt into your AI assistant to configure this project:

────────────────────────────────────────────────────────────
I have agent-config set up at .agent/config.yaml.

Please:
1. Read .agent/config.yaml
2. Explore the project directory structure to find where source
   code actually lives (check top-level dirs, look for src/, lib/,
   apps/, packages/, or named subdirectories with code)
3. Update coverage_paths in .agent/config.yaml to match the
   actual layout
4. Identify any stacks (typescript/javascript/python/elixir/
   rust/rails/mobile/containers/shell/go) present but not yet
   listed, and add them
5. If frontend conventions are desired, add:
   opinionated:
     presets: ["frontend-design"]
6. Make only the minimal necessary changes
────────────────────────────────────────────────────────────
`);
}
