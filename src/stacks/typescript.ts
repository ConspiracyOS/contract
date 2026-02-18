// src/stacks/typescript.ts
export const TS_CONTRACTS = [
  `id: C-TS01
description: TypeScript must compile without errors
type: atomic
trigger: commit
scope: global
checks:
  - name: tsc --noEmit passes
    command:
      run: "bun tsc --noEmit 2>&1 | tail -1"
      exit_code: 0
    on_fail: fail`,

  `id: C-TS02
description: No unchecked any casts in source
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.ts", "lib/**/*.ts"]
  exclude: ["**/*.test.ts", "**/*.d.ts"]
checks:
  - name: no bare as-any cast
    no_regex_in_file:
      pattern: 'as any(?!\s*\/\/ @contract)'
    on_fail: require_exemption`,
];

export const TS_CI_STEPS = `
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Type check
        run: bun tsc --noEmit
      - name: Lint
        run: bun run lint
      - name: Test
        run: bun test`;
