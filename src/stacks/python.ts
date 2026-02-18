// src/stacks/python.ts
export const PY_CONTRACTS = [
  `id: C-PY01
description: Python .venv must be at project root
type: atomic
trigger: commit
scope: global
checks:
  - name: .venv at project root
    path_exists:
      path: ".venv"
      type: directory
    on_fail: fail`,

  `id: C-PY02
description: Ruff linting must pass
type: atomic
trigger: commit
scope: global
checks:
  - name: ruff check
    command:
      run: "uv run ruff check ."
      exit_code: 0
    on_fail: fail`,

  `id: C-PY03
description: mypy strict must pass on public modules
type: atomic
trigger: pr
scope: global
checks:
  - name: mypy strict
    command:
      run: "uv run mypy --strict src/"
      exit_code: 0
    on_fail: fail
    skip_if:
      path_not_exists: "src"`,
];
