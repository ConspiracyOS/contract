package scaffold

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const defaultConfig = `# .contracts/config.yaml
# min_version: "0.2"  # fail early if contracts CLI is too old
# stack: [go, typescript, python, rust, elixir, javascript, rails, shell, containers, mobile]
stack: []
`

// InitProject creates .contracts/ structure in projectRoot.
func InitProject(projectRoot string) error {
	contractsDir := filepath.Join(projectRoot, ".contracts")
	if err := os.MkdirAll(contractsDir, 0755); err != nil {
		return err
	}
	fmt.Printf("  created %s\n", contractsDir)

	configPath := filepath.Join(contractsDir, "config.yaml")
	_, statErr := os.Stat(configPath)
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return fmt.Errorf("stat %s: %w", configPath, statErr)
	}
	if errors.Is(statErr, os.ErrNotExist) {
		if err := os.WriteFile(configPath, []byte(defaultConfig), 0644); err != nil {
			return err
		}
		fmt.Printf("  created %s\n", configPath)
	}

	return InstallHooks(projectRoot)
}
