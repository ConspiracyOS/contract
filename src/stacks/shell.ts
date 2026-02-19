export const SH_CONTRACTS = [
  `id: C-SH01
description: Shell scripts must use bash shebang
type: atomic
trigger: commit
scope:
  paths: ["scripts/**/*.sh"]
checks:
  - name: bash shebang present
    regex_in_file:
      pattern: "^#!/usr/bin/env bash"
    on_fail: fail`,

  `id: C-SH02
description: Shell scripts must use strict mode
type: atomic
trigger: commit
scope:
  paths: ["scripts/**/*.sh"]
checks:
  - name: strict mode set
    regex_in_file:
      pattern: "set -euo pipefail"
    on_fail: fail`,
];
