// src/stacks/rust.ts
export const RS_CONTRACTS = [
  `id: C-RS01
description: cargo clippy must pass with no warnings
type: atomic
trigger: commit
scope: global
checks:
  - name: cargo clippy clean
    command:
      run: "cargo clippy -- -D warnings 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail`,

  `id: C-RS02
description: cargo fmt must be clean
type: atomic
trigger: commit
scope: global
checks:
  - name: cargo fmt check
    command:
      run: "cargo fmt --check 2>&1"
      exit_code: 0
    on_fail: fail`,

  `id: C-RS03
description: All Rust modules must include property-based tests
type: atomic
trigger: pr
scope:
  paths: ["src/**/*.rs", "lib/**/*.rs"]
  exclude: ["**/build.rs", "**/*.pb.rs", "**/benches/**", "**/tests/**"]
checks:
  - name: proptest import present
    regex_in_file:
      pattern: "proptest::"
    on_fail: require_exemption`,
];
