package scaffold

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const defaultConfig = `# .agent/config.yaml
# stack: [go, typescript, python, rust]  # opt-in to stack-specific contracts
stack: []
`

// InitProject creates .agent/ structure in projectRoot.
func InitProject(projectRoot string) error {
	dirs := []string{
		filepath.Join(projectRoot, ".agent", "contracts"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return err
		}
		fmt.Printf("  created %s\n", d)
	}

	configPath := filepath.Join(projectRoot, ".agent", "config.yaml")
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
