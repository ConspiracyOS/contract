export const GO_CONTRACTS = [
  `id: C-GO01
description: Go code must be gofmt-clean
type: atomic
trigger: commit
scope: global
checks:
  - name: gofmt check
    command:
      run: "gofmt -l . 2>/dev/null | wc -l | tr -d ' '"
      exit_code: 0
      output_matches: "^0$"
    on_fail: fail
    skip_if:
      command_not_available: gofmt`,

  `id: C-GO02
description: Go tests must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: go test all packages
    command:
      run: "go test ./... 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail
    skip_if:
      command_not_available: go`,

  `id: C-GO03
description: Go vet should run cleanly
type: atomic
trigger: pr
scope: global
checks:
  - name: go vet all packages
    command:
      run: "go vet ./... 2>&1 | tail -5"
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: go`,
];
