package builtins

import (
	"fmt"
	"io/fs"
	"strings"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

// Load returns built-in contracts. Always includes "proc" contracts.
// Pass stacks like []string{"go", "typescript"} to add stack-specific contracts.
func Load(stacks []string) ([]*engine.Contract, error) {
	dirs := []string{"contracts/proc"}
	for _, s := range stacks {
		dirs = append(dirs, "contracts/stacks/"+s)
	}

	var contracts []*engine.Contract
	for _, dir := range dirs {
		entries, err := fs.ReadDir(contractsFS, dir)
		if err != nil {
			continue // dir doesn't exist for this stack
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
				continue
			}
			data, err := contractsFS.ReadFile(dir + "/" + e.Name())
			if err != nil {
				continue
			}
			c, err := engine.ParseContract(data)
			if err != nil {
				return nil, fmt.Errorf("builtin contract %s/%s: %w", dir, e.Name(), err)
			}
			c.Builtin = true
			contracts = append(contracts, c)
		}
	}
	return contracts, nil
}
