// src/stacks/containers.ts
export const CT_CONTRACTS = [
  `id: C-CT01
description: Docker services must not bind ports to host
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no host port binding
    no_regex_in_file:
      pattern: '"[0-9]+:[0-9]+"'
    on_fail: fail`,

  `id: C-CT03
description: No latest image tags in compose files
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no latest tag
    no_regex_in_file:
      pattern: ":latest"
    on_fail: warn`,

  `id: C-CT04
description: No localhost references in container service configs
type: atomic
trigger: commit
scope:
  paths: ["**/docker-compose*.yml", "**/docker-compose*.yaml", "**/compose*.yml", "**/compose*.yaml"]
checks:
  - name: no localhost in service config
    no_regex_in_file:
      pattern: "localhost"
    on_fail: require_exemption`,
];
