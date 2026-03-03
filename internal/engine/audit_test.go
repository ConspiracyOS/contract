package engine_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func passingContract(trigger engine.Trigger) *engine.Contract {
	return &engine.Contract{
		ID: "T-PASS", Description: "passing",
		Trigger: trigger,
		Scope:   engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name:    "pass",
			OnFail:  engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "true"},
		}},
	}
}

func failingContract(trigger engine.Trigger) *engine.Contract {
	return &engine.Contract{
		ID: "T-FAIL", Description: "failing",
		Trigger: trigger,
		Scope:   engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name:    "fail",
			OnFail:  engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
}

func TestAudit_TriggerFiltering(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract(engine.TriggerCommit),
		passingContract(engine.TriggerPR),
	}
	result := engine.RunAudit(contracts, engine.TriggerCommit, t.TempDir())
	// Only commit contract runs; PR contract is skipped
	if result.Passed != 1 {
		t.Fatalf("expected 1 passed, got %d", result.Passed)
	}
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
}

func TestAudit_Counts(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract(engine.TriggerCommit),
		failingContract(engine.TriggerCommit),
	}
	result := engine.RunAudit(contracts, engine.TriggerCommit, t.TempDir())
	if result.Passed != 1 || result.Failed != 1 {
		t.Fatalf("expected 1 pass 1 fail, got %d pass %d fail", result.Passed, result.Failed)
	}
}

func TestAudit_WarnCount(t *testing.T) {
	c := &engine.Contract{
		ID: "T-WARN", Description: "warn",
		Trigger: engine.TriggerCommit,
		Scope:   engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name: "warn", OnFail: engine.OnFailWarn,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, engine.TriggerCommit, t.TempDir())
	if result.Warned != 1 {
		t.Fatalf("expected 1 warned, got %d", result.Warned)
	}
}

func TestAudit_ExemptCount(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "main.go")
	os.WriteFile(f, []byte("// @contract:T-EXEMPT:exempt:legacy code\npackage main\n"), 0644)

	c := &engine.Contract{
		ID: "T-EXEMPT", Description: "exempt",
		Trigger: engine.TriggerCommit,
		Scope:   engine.Scope{Paths: []string{"*.go"}},
		Checks: []engine.Check{{
			Name: "exempt", OnFail: engine.OnFailRequireExemption,
			RegexInFile: &engine.RegexCheck{Pattern: "MISSING_PATTERN"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, engine.TriggerCommit, dir)
	if result.Exempt != 1 {
		t.Fatalf("expected 1 exempt, got %d: %+v", result.Exempt, result.Results)
	}
}

func TestAudit_EmptyScopeFallback(t *testing.T) {
	// No .ts files in dir → ResolveScope returns empty → falls back to GlobalSentinel
	// File-independent check (Command) runs once against GlobalSentinel
	c := &engine.Contract{
		ID: "T-SCOPE", Description: "scope fallback",
		Trigger: engine.TriggerCommit,
		Scope:   engine.Scope{Paths: []string{"*.ts"}},
		Checks: []engine.Check{{
			Name: "pass", OnFail: engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "true"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, engine.TriggerCommit, t.TempDir())
	if result.Passed != 1 {
		t.Fatalf("expected 1 passed (file-independent on GlobalSentinel fallback), got %d: %+v", result.Passed, result.Results)
	}
}

func TestAudit_ContractSkipIf(t *testing.T) {
	c := &engine.Contract{
		ID: "T-SKIP", Description: "skip",
		Trigger: engine.TriggerCommit,
		Scope:   engine.Scope{Global: true},
		SkipIf:  &engine.SkipIf{CommandNotAvailable: "contracts-not-a-real-bin-xyz"},
		Checks: []engine.Check{{
			Name: "fail", OnFail: engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, engine.TriggerCommit, t.TempDir())
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
}
