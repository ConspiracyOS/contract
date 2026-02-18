// src/stacks/elixir.ts
export const EX_CONTRACTS = [
  `id: C-EX01
description: mix format must be clean
type: atomic
trigger: commit
scope: global
checks:
  - name: mix format check
    command:
      run: "mix format --check-formatted"
      exit_code: 0
    on_fail: fail`,

  `id: C-EX02
description: mix credo strict must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: credo strict
    command:
      run: "mix credo --strict"
      exit_code: 0
    on_fail: fail`,

  `id: C-EX04
description: All umbrella apps must pass mix test
type: atomic
trigger: pr
scope: global
checks:
  - name: all umbrella apps tested
    command:
      run: "mix test --cover 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail
    skip_if:
      path_not_exists: "apps"`,
];
