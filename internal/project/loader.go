package project

import (
	"errors"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

// FindRoot walks up from cwd looking for .agent/config.yaml or .git.
// Returns cwd if neither is found.
func FindRoot(cwd string) string {
	dir := cwd
	for {
		if _, err := os.Stat(filepath.Join(dir, ".agent", "config.yaml")); err == nil {
			return dir
		}
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return cwd
		}
		dir = parent
	}
}

// LoadConfig reads .agent/config.yaml; returns empty Config if not present.
func LoadConfig(root string) (*Config, error) {
	path := filepath.Join(root, ".agent", "config.yaml")
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return &Config{}, nil
	}
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// LoadProjectContracts loads .agent/contracts/**/*.yaml from root.
// Returns nil (no error) if the directory doesn't exist.
func LoadProjectContracts(root string) ([]*engine.Contract, error) {
	dir := filepath.Join(root, ".agent", "contracts")
	var contracts []*engine.Contract

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(path) != ".yaml" {
			return nil
		}
		c, parseErr := engine.ParseContractFile(path)
		if parseErr != nil {
			return nil // skip invalid project contracts (don't abort)
		}
		contracts = append(contracts, c)
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	return contracts, err
}
