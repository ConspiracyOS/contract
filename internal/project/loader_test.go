package project_test

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/ConspiracyOS/contracts/internal/project"
)

func TestFindRoot_Git(t *testing.T) {
	// FindRoot should find a directory containing .git
	dir := t.TempDir()
	gitDir := filepath.Join(dir, ".git")
	os.MkdirAll(gitDir, 0755)

	got := project.FindRoot(dir)
	if got != dir {
		t.Fatalf("expected %s, got %s", dir, got)
	}
}

func TestFindRoot_AgentConfig(t *testing.T) {
	// FindRoot should prefer .agent/config.yaml over .git
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".agent")
	os.MkdirAll(agentDir, 0755)
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), []byte("stack: []"), 0644)

	got := project.FindRoot(dir)
	if got != dir {
		t.Fatalf("expected %s, got %s", dir, got)
	}
}

func TestFindRoot_NotFound(t *testing.T) {
	// FindRoot returns cwd if nothing found (walks up to fs root)
	// Use t.TempDir() — isolated from any git repo
	dir := t.TempDir()
	got := project.FindRoot(dir)
	// Should return dir itself (or some parent) — just must not panic
	if got == "" {
		t.Fatal("expected non-empty result")
	}
}

func TestLoadConfig_Empty(t *testing.T) {
	// LoadConfig returns empty Config if .agent/config.yaml doesn't exist
	cfg, err := project.LoadConfig(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if cfg == nil {
		t.Fatal("expected non-nil config")
	}
}

func TestLoadConfig_WithStack(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".agent")
	os.MkdirAll(agentDir, 0755)

	type raw struct {
		Stack []string `yaml:"stack"`
	}
	data, _ := yaml.Marshal(raw{Stack: []string{"go", "typescript"}})
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), data, 0644)

	cfg, err := project.LoadConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.Stack) != 2 {
		t.Fatalf("expected 2 stacks, got %v", cfg.Stack)
	}
}

func TestLoadConfig_BadYAML(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".agent")
	os.MkdirAll(agentDir, 0755)
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), []byte(":\ninvalid: [\n"), 0644)

	_, err := project.LoadConfig(dir)
	if err == nil {
		t.Fatal("expected error for bad YAML")
	}
}

func TestLoadProjectContracts_Empty(t *testing.T) {
	// Returns nil (no error) when .agent/contracts/ doesn't exist
	contracts, err := project.LoadProjectContracts(t.TempDir())
	if err != nil {
		t.Fatalf("expected no error for missing dir, got %v", err)
	}
	if len(contracts) != 0 {
		t.Fatalf("expected 0 contracts, got %d", len(contracts))
	}
}

func TestLoadProjectContracts_NonYamlFile(t *testing.T) {
	dir := t.TempDir()
	contractsDir := filepath.Join(dir, ".agent", "contracts")
	os.MkdirAll(contractsDir, 0755)
	// .json file should be skipped (only .yaml files are loaded)
	os.WriteFile(filepath.Join(contractsDir, "ignored.json"), []byte(`{"id":"X-001"}`), 0644)

	contracts, err := project.LoadProjectContracts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(contracts) != 0 {
		t.Fatalf("expected 0 contracts, got %d", len(contracts))
	}
}

func TestLoadProjectContracts_InvalidYAML(t *testing.T) {
	dir := t.TempDir()
	contractsDir := filepath.Join(dir, ".agent", "contracts")
	os.MkdirAll(contractsDir, 0755)
	// Invalid contract — missing required fields — should be silently skipped
	os.WriteFile(filepath.Join(contractsDir, "bad.yaml"), []byte("notacontract: true\n"), 0644)

	contracts, err := project.LoadProjectContracts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(contracts) != 0 {
		t.Fatalf("expected 0 contracts (invalid YAML skipped), got %d", len(contracts))
	}
}

func TestLoadProjectContracts_OneContract(t *testing.T) {
	dir := t.TempDir()
	contractsDir := filepath.Join(dir, ".agent", "contracts")
	os.MkdirAll(contractsDir, 0755)

	yaml := `id: C-TEST-001
description: test
type: atomic
trigger: commit
scope: global
checks:
  - name: ok
    command:
      run: "true"
      exit_code: 0
    on_fail: fail
`
	os.WriteFile(filepath.Join(contractsDir, "test.yaml"), []byte(yaml), 0644)

	contracts, err := project.LoadProjectContracts(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(contracts) != 1 {
		t.Fatalf("expected 1 contract, got %d", len(contracts))
	}
	if contracts[0].ID != "C-TEST-001" {
		t.Fatalf("unexpected ID: %s", contracts[0].ID)
	}
}
