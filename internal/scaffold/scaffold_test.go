package scaffold_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/scaffold"
)

func TestInstallHooks_NoGit(t *testing.T) {
	dir := t.TempDir()
	// No .git directory — should return error
	err := scaffold.InstallHooks(dir)
	if err == nil {
		t.Fatal("expected error for missing .git/hooks")
	}
}

func TestInstallHooks_WithGit(t *testing.T) {
	dir := t.TempDir()
	hooksDir := filepath.Join(dir, ".git", "hooks")
	os.MkdirAll(hooksDir, 0755)

	err := scaffold.InstallHooks(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify hooks were written
	for _, name := range []string{"pre-commit", "pre-push"} {
		path := filepath.Join(hooksDir, name)
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			t.Fatalf("expected hook %s to exist", name)
		}
		// Verify executable
		info, _ := os.Stat(path)
		if info.Mode()&0111 == 0 {
			t.Fatalf("expected hook %s to be executable", name)
		}
	}
}

func TestInstallHooks_Idempotent(t *testing.T) {
	dir := t.TempDir()
	hooksDir := filepath.Join(dir, ".git", "hooks")
	os.MkdirAll(hooksDir, 0755)

	// Run twice — should not error
	if err := scaffold.InstallHooks(dir); err != nil {
		t.Fatal(err)
	}
	if err := scaffold.InstallHooks(dir); err != nil {
		t.Fatalf("second call should be idempotent: %v", err)
	}
}

func TestInstallHooks_WriteError(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("test requires non-root")
	}
	dir := t.TempDir()
	hooksDir := filepath.Join(dir, ".git", "hooks")
	os.MkdirAll(hooksDir, 0755)
	os.Chmod(hooksDir, 0555)
	defer os.Chmod(hooksDir, 0755)

	err := scaffold.InstallHooks(dir)
	if err == nil {
		t.Fatal("expected error writing to read-only hooks dir")
	}
	if !strings.Contains(err.Error(), "writing pre") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestInitProject(t *testing.T) {
	dir := t.TempDir()
	// Create .git/hooks so InstallHooks works
	os.MkdirAll(filepath.Join(dir, ".git", "hooks"), 0755)

	err := scaffold.InitProject(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// .agent/contracts/ should exist
	contractsDir := filepath.Join(dir, ".agent", "contracts")
	if _, err := os.Stat(contractsDir); errors.Is(err, os.ErrNotExist) {
		t.Fatal("expected .agent/contracts/ to exist")
	}

	// .agent/config.yaml should exist
	configPath := filepath.Join(dir, ".agent", "config.yaml")
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		t.Fatal("expected .agent/config.yaml to exist")
	}
}

func TestInitProject_Idempotent(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, ".git", "hooks"), 0755)

	// First call
	if err := scaffold.InitProject(dir); err != nil {
		t.Fatal(err)
	}

	// Write custom content to config
	configPath := filepath.Join(dir, ".agent", "config.yaml")
	os.WriteFile(configPath, []byte("stack: [go]"), 0644)

	// Second call — must not overwrite config
	if err := scaffold.InitProject(dir); err != nil {
		t.Fatal(err)
	}

	data, _ := os.ReadFile(configPath)
	if string(data) != "stack: [go]" {
		t.Fatalf("expected config preserved, got: %s", string(data))
	}
}
