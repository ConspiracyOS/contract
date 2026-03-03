package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeContract(t *testing.T, dir, name, content string) {
	t.Helper()
	contractsDir := filepath.Join(dir, ".agent", "contracts")
	os.MkdirAll(contractsDir, 0755)
	os.WriteFile(filepath.Join(contractsDir, name), []byte(content), 0644)
}

func TestAuditIn_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	// noBuiltins=true: only project contracts, empty dir → "No contracts found"
	code, err := auditIn(dir, "commit", true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 for empty dir, got %d", code)
	}
}

func TestAuditIn_PassingContract(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pass.yaml", `
id: TEST-PASS
description: Always passing
type: detective
trigger: commit
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := auditIn(dir, "commit", true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 for passing contract, got %d", code)
	}
}

func TestAuditIn_FailingContract(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "fail.yaml", `
id: TEST-FAIL
description: Always failing
type: detective
trigger: commit
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	code, err := auditIn(dir, "commit", true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for failing contract, got %d", code)
	}
}

func TestAuditIn_JSONOutput(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pass.yaml", `
id: TEST-JSON
description: JSON output test
type: detective
trigger: commit
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := auditIn(dir, "commit", true, false, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
}

func TestAuditIn_NoBuiltins(t *testing.T) {
	dir := t.TempDir()
	// No project contracts, no builtins → empty
	code, err := auditIn(dir, "commit", true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
}

func TestListContractsIn_Empty(t *testing.T) {
	dir := t.TempDir()
	if err := listContractsIn(dir); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestListContractsIn_WithContract(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "c.yaml", `
id: LIST-001
description: Listed contract
type: detective
trigger: commit
scope: global
checks:
  - name: ok
    command:
      run: "true"
    on_fail: fail
`)
	if err := listContractsIn(dir); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCheckContractIn_NotFound(t *testing.T) {
	dir := t.TempDir()
	_, err := checkContractIn(dir, "NONEXISTENT-001", "commit")
	if err == nil {
		t.Fatal("expected error for nonexistent contract")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestCheckContractIn_Pass(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "check.yaml", `
id: CHECK-001
description: Check test
type: detective
trigger: commit
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := checkContractIn(dir, "CHECK-001", "commit")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 for passing contract, got %d", code)
	}
}

func TestCheckContractIn_Fail(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "check.yaml", `
id: CHECK-002
description: Failing check
type: detective
trigger: commit
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	code, err := checkContractIn(dir, "CHECK-002", "commit")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for failing contract, got %d", code)
	}
}

func TestAuditIn_WithBuiltins(t *testing.T) {
	// noBuiltins=false loads built-in contracts; covers builtins.Load path in auditIn
	dir := t.TempDir()
	// No project contracts; builtins may pass or fail — just verify no error
	_, err := auditIn(dir, "commit", false, false, false)
	if err != nil {
		t.Fatalf("unexpected error loading builtins: %v", err)
	}
}

func TestAuditIn_Verbose(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "v.yaml", `
id: VERBOSE-001
description: Verbose output test
type: detective
trigger: commit
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := auditIn(dir, "commit", true, true, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
}

func TestListContractsIn_BadConfig(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".agent")
	os.MkdirAll(agentDir, 0755)
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), []byte(":\ninvalid:\n"), 0644)

	err := listContractsIn(dir)
	if err == nil {
		t.Fatal("expected error for bad config")
	}
	if !strings.Contains(err.Error(), "loading config") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestAuditIn_BadConfig(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".agent")
	os.MkdirAll(agentDir, 0755)
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), []byte(":\ninvalid:\n"), 0644)

	_, err := auditIn(dir, "commit", true, false, false)
	if err == nil {
		t.Fatal("expected error for bad config")
	}
	if !strings.Contains(err.Error(), "loading config") {
		t.Errorf("unexpected error: %v", err)
	}
}
