export const JS_CONTRACTS = [
  `id: C-JS01
description: JavaScript lint should pass when configured
type: atomic
trigger: commit
scope: global
checks:
  - name: npm lint
    command:
      run: "npm run lint --if-present 2>&1 | tail -5"
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: npm`,

  `id: C-JS02
description: JavaScript tests should pass when configured
type: atomic
trigger: pr
scope: global
checks:
  - name: npm test
    command:
      run: "npm test --if-present 2>&1 | tail -5"
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: npm`,

  `id: C-JS03
description: No eval usage in JavaScript source
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.js", "lib/**/*.js", "app/**/*.js", "**/*.mjs", "**/*.cjs"]
  exclude: ["**/*.test.js", "**/*.spec.js"]
checks:
  - name: no eval in source
    no_regex_in_file:
      pattern: '\\beval\\s*\\('
    on_fail: require_exemption`,
];
