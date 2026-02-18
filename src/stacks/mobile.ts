// src/stacks/mobile.ts
export const MO_CONTRACTS = [
  `id: C-MO01
description: expo-doctor must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: expo-doctor
    command:
      run: "npx expo-doctor 2>&1 | tail -5"
      exit_code: 0
    on_fail: warn
    skip_if:
      path_not_exists: app.json`,

  `id: C-MO02
description: No hardcoded localhost in non-test source
type: atomic
trigger: commit
scope:
  paths: ["src/**/*", "app/**/*", "components/**/*"]
  exclude: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"]
checks:
  - name: no hardcoded localhost
    no_regex_in_file:
      pattern: "localhost"
    on_fail: require_exemption`,
];
