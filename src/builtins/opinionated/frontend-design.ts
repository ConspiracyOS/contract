export const FD_CONTRACTS = [
  `id: C-FD01
description: Frontend stack should include Tailwind and shadcn/ui setup
type: atomic
trigger: commit
scope: global
checks:
  - name: tailwind dependency present
    regex_in_file:
      pattern: '"(tailwindcss|@tailwindcss/postcss)"'
    on_fail: require_exemption
    skip_if:
      path_not_exists: package.json
  - name: shadcn components manifest exists
    path_exists:
      path: components.json
    on_fail: require_exemption`,

  `id: C-FD02
description: Prefer shadcn/ui composition over hand-rolled utility class blocks
type: atomic
trigger: commit
scope:
  paths: ["src/**/*.tsx", "src/**/*.jsx", "app/**/*.tsx", "app/**/*.jsx", "components/**/*.tsx", "components/**/*.jsx"]
  exclude: ["**/components/ui/**", "**/*.test.*", "**/*.spec.*", "**/__tests__/**"]
checks:
  - name: avoid dense inline utility class strings outside ui primitives
    no_regex_in_file:
      pattern: 'className="[^"]*(bg-|text-|p-[0-9]|px-|py-|mx-|my-|rounded-|shadow-|grid|flex)[^"]*"'
    on_fail: require_exemption`,

  `id: C-FD03
description: Frontend styles should define CSS variables for theme and dark mode
type: atomic
trigger: commit
scope: global
checks:
  - name: css variables declared under :root
    command:
      run: 'if [ -d src ] || [ -d app ] || [ -d styles ]; then rg -n --glob "**/*.css" ":root\\s*\\{[^}]*--[a-zA-Z0-9-]+\\s*:" src app styles >/dev/null 2>&1; else exit 0; fi'
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: rg
  - name: dark mode selector declares theme vars
    command:
      run: 'if [ -d src ] || [ -d app ] || [ -d styles ]; then rg -n --glob "**/*.css" "\\.dark\\s*\\{[^}]*--[a-zA-Z0-9-]+\\s*:" src app styles >/dev/null 2>&1; else exit 0; fi'
      exit_code: 0
    on_fail: warn
    skip_if:
      command_not_available: rg`,
];
