// src/stacks/rails.ts
// @contract:C-PROC03:exempt:contract-definition-file-contains-find_by-as-literal-text
export const RB_CONTRACTS = [
  `id: C-RB01
description: Rubocop linting must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: bundle exec rubocop
    command:
      run: "bundle exec rubocop --format progress 2>&1 | tail -3"
      exit_code: 0
    on_fail: fail`,

  `id: C-RB02
description: Rails test suite must pass
type: atomic
trigger: pr
scope: global
checks:
  - name: bundle exec rails test
    command:
      run: "bundle exec rails test 2>&1 | tail -5"
      exit_code: 0
    on_fail: fail
    skip_if:
      path_not_exists: test`,

  `id: C-RB03
description: find_by calls must include nil guard
type: atomic
trigger: commit
scope:
  paths: ["app/**/*.rb"]
checks:
  - name: no bare find_by without nil guard
    no_regex_in_file:
      pattern: 'find_by\\([^)]+\\)\\.'
    on_fail: require_exemption`,

  `id: C-RB04
description: Bullet gem must be present for N+1 detection
type: atomic
trigger: commit
scope:
  paths: ["Gemfile"]
checks:
  - name: bullet gem in Gemfile
    regex_in_file:
      pattern: "bullet"
    on_fail: warn
    skip_if:
      path_not_exists: Gemfile`,
];
