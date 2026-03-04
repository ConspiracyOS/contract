package scaffold

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const preCommitHook = `#!/bin/sh
if ! command -v contracts >/dev/null 2>&1; then
  echo "contracts not found — skipping checks. Install: go install github.com/ConspiracyOS/contracts/cmd/contracts@latest"
  exit 0
fi
contracts check --tags pre-commit
`

const prePushHook = `#!/bin/sh
if ! command -v contracts >/dev/null 2>&1; then
  echo "contracts not found — skipping checks. Install: go install github.com/ConspiracyOS/contracts/cmd/contracts@latest"
  exit 0
fi
contracts check --tags pre-push
`

// InstallHooks writes git hooks to .git/hooks/ — idempotent.
func InstallHooks(projectRoot string) error {
	hooksDir := filepath.Join(projectRoot, ".git", "hooks")
	if _, err := os.Stat(hooksDir); errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf(".git/hooks not found — is this a git repo?")
	}

	hooks := map[string]string{
		"pre-commit": preCommitHook,
		"pre-push":   prePushHook,
	}
	for name, content := range hooks {
		path := filepath.Join(hooksDir, name)
		if err := os.WriteFile(path, []byte(content), 0755); err != nil {
			return fmt.Errorf("writing %s: %w", name, err)
		}
		fmt.Printf("  installed %s\n", path)
	}
	return nil
}
