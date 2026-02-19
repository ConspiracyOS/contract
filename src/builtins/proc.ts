// src/builtins/proc.ts
// @contract:C-PROC03:exempt:contract-definition-file-contains-TODO-as-literal-text
// Built-in process contracts as YAML strings — bundled with binary

export const PROC_CONTRACTS = [
  // C-SEC02: Real secrets scan using gitleaks or trufflehog
  `id: C-SEC02
description: Source must pass secrets scan (gitleaks or trufflehog)
type: atomic
trigger: pr
scope: global
checks:
  - name: secrets scan
    command:
      run: "if command -v gitleaks >/dev/null 2>&1; then gitleaks detect --no-git --source . --exit-code 1 2>&1; elif command -v trufflehog >/dev/null 2>&1; then trufflehog filesystem . --only-verified --fail 2>&1; else echo 'No secrets scanner found. Install: brew install gitleaks'; exit 1; fi"
      exit_code: 0
    on_fail: warn`,

  // C-PROC02: PR description references issue
  `id: C-PROC02
description: PR description must reference a GitHub issue
type: atomic
trigger: pr
scope:
  paths: [".github/PULL_REQUEST_TEMPLATE.md"]
checks:
  - name: PR template has issue section
    regex_in_file:
      pattern: "Closes #"
    on_fail: warn`,

  // C-PROC03: No bare TODOs
  `id: C-PROC03
description: TODO comments must include an issue reference
type: atomic
trigger: commit
scope:
  paths: ["src/**/*", "lib/**/*", "app/**/*"]
  exclude: ["**/*.md"]
checks:
  - name: no bare TODO without issue ref
    no_regex_in_file:
      pattern: 'TODO(?!\(#[0-9]+\))'
    on_fail: require_exemption`,

  // C-PROC05: worktrees/ is gitignored
  `id: C-PROC05
description: worktrees/ must be gitignored
type: atomic
trigger: commit
scope:
  paths: [".gitignore"]
checks:
  - name: worktrees in .gitignore
    regex_in_file:
      pattern: "^worktrees/"
    on_fail: fail`,

  // C-PROC06: tmp/ contains no files older than 7 days
  `id: C-PROC06
description: tmp/ directory must not contain stale scripts
type: atomic
trigger: pr
scope: global
checks:
  - name: no stale tmp files
    command:
      run: "find tmp/ -type f -mtime +7 2>/dev/null | wc -l | tr -d ' '"
      exit_code: 0
      output_matches: "^0$"
    on_fail: warn
    skip_if:
      path_not_exists: "tmp"`,

  // C-DOC01: ARCHITECTURE.md must exist
  `id: C-DOC01
description: docs/ARCHITECTURE.md must exist
type: atomic
trigger: commit
scope: global
checks:
  - name: ARCHITECTURE.md present
    path_exists:
      path: docs/ARCHITECTURE.md
    on_fail: fail
    skip_if:
      path_not_exists: docs`,

  // C-DOC02: docs/ markdown files must declare type header
  `id: C-DOC02
description: Markdown files in docs/ must have a type header
type: atomic
trigger: commit
scope:
  paths: ["docs/*.md"]
checks:
  - name: type header present
    regex_in_file:
      pattern: "<!-- type:"
    on_fail: warn
    skip_if:
      path_not_exists: docs`,

  // C-SEC01: .env files must not be committed (must be in .gitignore)
  `id: C-SEC01
description: .env files must be gitignored
type: atomic
trigger: commit
scope:
  paths: [".gitignore"]
checks:
  - name: .env in .gitignore
    regex_in_file:
      pattern: '^\\.env'
    on_fail: fail`,

  // C-SEC03: vault password files must be gitignored
  `id: C-SEC03
description: .vault_password files must be gitignored
type: atomic
trigger: commit
scope:
  paths: [".gitignore"]
checks:
  - name: .vault_password in .gitignore
    regex_in_file:
      pattern: '^\\.vault_password'
    on_fail: fail
    skip_if:
      path_not_exists: .agent/vault`,
];
