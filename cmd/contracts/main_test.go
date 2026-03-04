package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeContract(t *testing.T, dir, name, content string) {
	t.Helper()
	contractsDir := filepath.Join(dir, ".contracts")
	os.MkdirAll(contractsDir, 0755)
	os.WriteFile(filepath.Join(contractsDir, name), []byte(content), 0644)
}

func TestCheckIn_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	// noBuiltins=true: only project contracts, empty dir → "No contracts found"
	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 for empty dir, got %d", code)
	}
}

func TestCheckIn_PassingContract(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pass.yaml", `
id: TEST-PASS
description: Always passing
type: detective
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 for passing contract, got %d", code)
	}
}

func TestCheckIn_FailingContract(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "fail.yaml", `
id: TEST-FAIL
description: Always failing
type: detective
tags: [pre-commit]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for failing contract, got %d", code)
	}
}

func TestCheckIn_JSONOutput(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pass.yaml", `
id: TEST-JSON
description: JSON output test
type: detective
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := checkIn(dir, nil, nil, true, false, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
}

func TestCheckIn_NoBuiltins(t *testing.T) {
	dir := t.TempDir()
	// No project contracts, no builtins → empty
	code, err := checkIn(dir, nil, nil, true, false, false)
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
tags: [pre-commit]
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
	_, err := checkContractIn(dir, "NONEXISTENT-001")
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
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := checkContractIn(dir, "CHECK-001")
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
tags: [pre-commit]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	code, err := checkContractIn(dir, "CHECK-002")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for failing contract, got %d", code)
	}
}

func TestCheckIn_WithBuiltins(t *testing.T) {
	// noBuiltins=false loads built-in contracts; covers builtins.Load path in checkIn
	dir := t.TempDir()
	// No project contracts; builtins may pass or fail — just verify no error
	_, err := checkIn(dir, nil, nil, false, false, false)
	if err != nil {
		t.Fatalf("unexpected error loading builtins: %v", err)
	}
}

func TestCheckIn_Verbose(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "v.yaml", `
id: VERBOSE-001
description: Verbose output test
type: detective
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	code, err := checkIn(dir, nil, nil, true, true, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0, got %d", code)
	}
}

func TestListContractsIn_BadConfig(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".contracts")
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

func TestCheckIn_BadConfig(t *testing.T) {
	dir := t.TempDir()
	agentDir := filepath.Join(dir, ".contracts")
	os.MkdirAll(agentDir, 0755)
	os.WriteFile(filepath.Join(agentDir, "config.yaml"), []byte(":\ninvalid:\n"), 0644)

	_, err := checkIn(dir, nil, nil, true, false, false)
	if err == nil {
		t.Fatal("expected error for bad config")
	}
	if !strings.Contains(err.Error(), "loading config") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestCheckIn_EscalationDispatched(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, ".contracts"), 0755)

	writeContract(t, dir, "esc.yaml", `
id: ESC-001
description: escalation test
type: detective
tags: [schedule]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: escalate
`)

	outFile := filepath.Join(dir, "escalation-out.json")
	os.WriteFile(filepath.Join(dir, ".contracts", "config.yaml"), []byte("escalation:\n  command: \"cat > "+outFile+"\"\n"), 0644)

	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for escalate failure, got %d", code)
	}

	data, err := os.ReadFile(outFile)
	if err != nil {
		t.Fatalf("expected escalation payload file to be written: %v", err)
	}
	if !strings.Contains(string(data), "ESC-001") {
		t.Errorf("expected ESC-001 in payload, got: %s", data)
	}
}

func TestCheckIn_EscalationNotDispatchedForPlainFail(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, ".contracts"), 0755)

	writeContract(t, dir, "fail.yaml", `
id: PLAIN-001
description: plain fail
type: detective
tags: [pre-commit]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	outFile := filepath.Join(dir, "should-not-exist.json")
	os.WriteFile(filepath.Join(dir, ".contracts", "config.yaml"), []byte("escalation:\n  command: \"cat > "+outFile+"\"\n"), 0644)

	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1 for plain fail, got %d", code)
	}
	if _, err := os.Stat(outFile); err == nil {
		t.Error("escalation command must not run for plain on_fail: fail")
	}
}

func TestCheckIn_NoEscalationConfig(t *testing.T) {
	dir := t.TempDir()
	// escalate check fails, but no escalation config → just exit 1, no dispatch
	writeContract(t, dir, "esc.yaml", `
id: ESC-002
description: no config
type: detective
tags: [schedule]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: escalate
`)
	code, err := checkIn(dir, nil, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 1 {
		t.Errorf("expected exit 1, got %d", code)
	}
	// No dispatch file to check — just must not panic
}

func TestCheckIn_TagFilter(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pre.yaml", `
id: TAG-PRE
description: pre-commit contract
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	writeContract(t, dir, "sched.yaml", `
id: TAG-SCHED
description: schedule contract
type: detective
tags: [schedule]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	// Filter to pre-commit only — schedule contract must not run (must not fail)
	code, err := checkIn(dir, []string{"pre-commit"}, nil, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 (only pre-commit runs, and it passes), got %d", code)
	}
}

func TestCheckIn_SkipTags(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "fast.yaml", `
id: SKIP-FAST
description: fast contract
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: pass
    command:
      run: "true"
    on_fail: fail
`)
	writeContract(t, dir, "slow.yaml", `
id: SKIP-SLOW
description: slow failing contract
type: detective
tags: [pre-commit, slow]
scope: global
checks:
  - name: fail
    command:
      run: "false"
    on_fail: fail
`)
	// Skip slow — only SKIP-FAST runs, must pass
	code, err := checkIn(dir, nil, []string{"slow"}, true, false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if code != 0 {
		t.Errorf("expected exit 0 (slow contract skipped), got %d", code)
	}
}

func TestBriefIn_NoFindings(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "pass.yaml", `
id: BRIEF-PASS
description: passing
type: atomic
tags: [pre-commit]
scope: global
checks:
  - name: ok
    command:
      run: "true"
    on_fail: fail
`)
	err := briefIn(dir, nil, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBriefIn_WithFailure(t *testing.T) {
	dir := t.TempDir()
	writeContract(t, dir, "fail.yaml", `
id: BRIEF-FAIL
description: disk check
type: detective
tags: [schedule]
scope: global
checks:
  - name: disk
    severity: critical
    category: performance
    what: "Disk usage too high"
    verify: "df /"
    command:
      run: "false"
    on_fail: fail
`)
	err := briefIn(dir, nil, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// briefIn exits 0 regardless — it's informational, not enforcement
}
