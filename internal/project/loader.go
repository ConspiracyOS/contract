package project

import (
	"errors"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

// SystemContractsDir returns the path to the user's system-wide contracts directory.
// Respects $XDG_CONFIG_HOME; falls back to ~/.config/contracts.
func SystemContractsDir() string {
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "contracts")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "contracts")
}

// LoadSystemContracts loads contracts from the user's system-wide contracts directory.
// Returns nil (no error) if the directory doesn't exist.
func LoadSystemContracts() ([]*engine.Contract, error) {
	return LoadDir(SystemContractsDir())
}

// FindRoot walks up from cwd looking for .contracts/config.yaml or .git.
// Returns cwd if neither is found.
func FindRoot(cwd string) string {
	dir := cwd
	for {
		if _, err := os.Stat(filepath.Join(dir, ".contracts", "config.yaml")); err == nil {
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

// LoadConfig reads .contracts/config.yaml; returns empty Config if not present.
func LoadConfig(root string) (*Config, error) {
	path := filepath.Join(root, ".contracts", "config.yaml")
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

// LoadProjectContracts loads .contracts/*.yaml from root, skipping config.yaml.
// Returns nil (no error) if the directory doesn't exist.
func LoadProjectContracts(root string) ([]*engine.Contract, error) {
	return LoadDir(filepath.Join(root, ".contracts"))
}

// LoadDir loads all *.yaml contracts from dir recursively, skipping config.yaml.
// Returns nil (no error) if the directory doesn't exist.
func LoadDir(dir string) ([]*engine.Contract, error) {
	var contracts []*engine.Contract

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(path) != ".yaml" {
			return nil
		}
		if filepath.Base(path) == "config.yaml" {
			return nil
		}
		c, parseErr := engine.ParseContractFile(path)
		if parseErr != nil {
			return nil // skip invalid contracts (don't abort)
		}
		contracts = append(contracts, c)
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	return contracts, err
}
