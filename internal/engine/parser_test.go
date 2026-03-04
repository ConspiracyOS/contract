package engine_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestParseContract_Valid(t *testing.T) {
	c, err := engine.ParseContractFile("testdata/valid.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if c.ID != "C-TEST-001" {
		t.Fatalf("expected C-TEST-001, got %s", c.ID)
	}
	if len(c.Tags) != 1 || c.Tags[0] != "pre-commit" {
		t.Fatalf("expected [pre-commit], got %v", c.Tags)
	}
	if len(c.Checks) != 1 {
		t.Fatalf("expected 1 check, got %d", len(c.Checks))
	}
	if c.Checks[0].Command == nil {
		t.Fatal("expected command check")
	}
	if c.Checks[0].Command.Run != "echo ok" {
		t.Fatalf("unexpected run: %s", c.Checks[0].Command.Run)
	}
}

func TestParseContract_TagsScalar(t *testing.T) {
	c, err := engine.ParseContractFile("testdata/schedule.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Tags) != 1 || c.Tags[0] != "schedule" {
		t.Fatalf("expected [schedule], got %v", c.Tags)
	}
	if !c.Scope.Global {
		t.Fatal("expected global scope")
	}
}

func TestParseContract_TagsList(t *testing.T) {
	raw := `id: X-TAGS
description: test
type: atomic
tags: [pre-commit, security]
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Tags) != 2 || c.Tags[0] != "pre-commit" || c.Tags[1] != "security" {
		t.Fatalf("expected [pre-commit, security], got %v", c.Tags)
	}
}

func TestParseContract_NoTags(t *testing.T) {
	raw := `id: X-NOTAGS
description: test
type: atomic
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Tags) != 0 {
		t.Fatalf("expected no tags, got %v", c.Tags)
	}
}

func TestParseContract_ScopeGlobal(t *testing.T) {
	raw := `id: X-001
description: test
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if !c.Scope.Global {
		t.Fatal("expected global scope")
	}
}

func TestParseContract_ScopePaths(t *testing.T) {
	raw := `id: X-002
description: test
type: atomic
tags: pre-commit
scope:
  paths: ["src/**/*"]
  exclude: ["**/*.test.ts"]
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if c.Scope.Global {
		t.Fatal("expected non-global scope")
	}
	if len(c.Scope.Paths) != 1 || c.Scope.Paths[0] != "src/**/*" {
		t.Fatalf("unexpected paths: %v", c.Scope.Paths)
	}
}

func TestParseContract_MissingID(t *testing.T) {
	raw := `description: test
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: ok
    command:
      run: "true"
`
	_, err := engine.ParseContract([]byte(raw))
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestParseContract_MissingDescription(t *testing.T) {
	raw := `id: X-005
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: ok
    command:
      run: "true"
`
	_, err := engine.ParseContract([]byte(raw))
	if err == nil {
		t.Fatal("expected error for missing description")
	}
}

func TestParseContract_InvalidScopeScalar(t *testing.T) {
	raw := `id: X-006
description: test
type: atomic
tags: [pre-commit]
scope: badscope
checks:
  - name: ok
    command:
      run: "true"
`
	_, err := engine.ParseContract([]byte(raw))
	if err == nil {
		t.Fatal("expected error for invalid scope scalar")
	}
}

func TestParseContractFile_NotFound(t *testing.T) {
	_, err := engine.ParseContractFile("/nonexistent-xyz/contract.yaml")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}

func TestParseContractFile_InvalidContent(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "bad.yaml")
	os.WriteFile(f, []byte("not: a: valid: contract\n"), 0644)
	_, err := engine.ParseContractFile(f)
	if err == nil {
		t.Fatal("expected error for invalid contract content")
	}
}

func TestParseContract_InvalidYAML(t *testing.T) {
	_, err := engine.ParseContract([]byte(":\t:\ninvalid[yaml"))
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

func TestParseContract_NoScopeField(t *testing.T) {
	// Missing scope key → parseScope receives empty node → defaults to global
	raw := `id: X-007
description: test
type: atomic
tags: [pre-commit]
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if !c.Scope.Global {
		t.Fatal("expected global scope when scope field absent")
	}
}

func TestParseContract_ScopeEmptyPaths(t *testing.T) {
	// scope mapping with no paths → defaults to **/*
	raw := `id: X-008
description: test
type: atomic
tags: [pre-commit]
scope:
  exclude: ["**/*.test.go"]
checks:
  - name: ok
    command:
      run: "true"
`
	c, err := engine.ParseContract([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Scope.Paths) == 0 || c.Scope.Paths[0] != "**/*" {
		t.Fatalf("expected default path **/* when paths empty, got: %v", c.Scope.Paths)
	}
}

func TestParseContract_EmptyChecks(t *testing.T) {
	raw := `id: X-004
description: test
type: atomic
tags: [pre-commit]
scope: global
checks: []
`
	_, err := engine.ParseContract([]byte(raw))
	if err == nil {
		t.Fatal("expected error for empty checks")
	}
}
