package engine_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func passingContract(tags ...string) *engine.Contract {
	return &engine.Contract{
		ID: "T-PASS", Description: "passing",
		Tags:  tags,
		Scope: engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name:    "pass",
			OnFail:  engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "true"},
		}},
	}
}

func failingContract(tags ...string) *engine.Contract {
	return &engine.Contract{
		ID: "T-FAIL", Description: "failing",
		Tags:  tags,
		Scope: engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name:    "fail",
			OnFail:  engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
}

func TestAudit_TagFiltering(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract("pre-commit"),
		passingContract("pre-push"),
	}
	result := engine.RunAudit(contracts, []string{"pre-commit"}, t.TempDir())
	// Only pre-commit contract runs; pre-push contract is skipped
	if result.Passed != 1 {
		t.Fatalf("expected 1 passed, got %d", result.Passed)
	}
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
}

func TestAudit_NoFilterRunsAll(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract("pre-commit"),
		passingContract("schedule"),
	}
	result := engine.RunAudit(contracts, nil, t.TempDir())
	if result.Passed != 2 {
		t.Fatalf("expected 2 passed (no filter = run all), got %d", result.Passed)
	}
}

func TestAudit_AlwaysTagBypassesFilter(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract("always"),
		passingContract("pre-push"),
	}
	result := engine.RunAudit(contracts, []string{"pre-commit"}, t.TempDir())
	// "always" contract runs; pre-push is skipped
	if result.Passed != 1 {
		t.Fatalf("expected 1 passed, got %d", result.Passed)
	}
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
}

func TestAudit_Counts(t *testing.T) {
	contracts := []*engine.Contract{
		passingContract("pre-commit"),
		failingContract("pre-commit"),
	}
	result := engine.RunAudit(contracts, []string{"pre-commit"}, t.TempDir())
	if result.Passed != 1 || result.Failed != 1 {
		t.Fatalf("expected 1 pass 1 fail, got %d pass %d fail", result.Passed, result.Failed)
	}
}

func TestAudit_WarnCount(t *testing.T) {
	c := &engine.Contract{
		ID: "T-WARN", Description: "warn",
		Tags:  []string{"pre-commit"},
		Scope: engine.Scope{Global: true},
		Checks: []engine.Check{{
			Name: "warn", OnFail: engine.OnFailWarn,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, []string{"pre-commit"}, t.TempDir())
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
		Tags:  []string{"pre-commit"},
		Scope: engine.Scope{Paths: []string{"*.go"}},
		Checks: []engine.Check{{
			Name: "exempt", OnFail: engine.OnFailRequireExemption,
			RegexInFile: &engine.RegexCheck{Pattern: "MISSING_PATTERN"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, []string{"pre-commit"}, dir)
	if result.Exempt != 1 {
		t.Fatalf("expected 1 exempt, got %d: %+v", result.Exempt, result.Results)
	}
}

func TestAudit_EmptyScopeFallback(t *testing.T) {
	// No .ts files in dir → ResolveScope returns empty → falls back to GlobalSentinel
	// File-independent check (Command) runs once against GlobalSentinel
	c := &engine.Contract{
		ID: "T-SCOPE", Description: "scope fallback",
		Tags:  []string{"pre-commit"},
		Scope: engine.Scope{Paths: []string{"*.ts"}},
		Checks: []engine.Check{{
			Name: "pass", OnFail: engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "true"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, []string{"pre-commit"}, t.TempDir())
	if result.Passed != 1 {
		t.Fatalf("expected 1 passed (file-independent on GlobalSentinel fallback), got %d: %+v", result.Passed, result.Results)
	}
}

func TestAudit_ContractSkipIf(t *testing.T) {
	c := &engine.Contract{
		ID: "T-SKIP", Description: "skip",
		Tags:   []string{"pre-commit"},
		Scope:  engine.Scope{Global: true},
		SkipIf: &engine.SkipIf{CommandNotAvailable: "contracts-not-a-real-bin-xyz"},
		Checks: []engine.Check{{
			Name: "fail", OnFail: engine.OnFailFail,
			Command: &engine.CommandCheck{Run: "false"},
		}},
	}
	result := engine.RunAudit([]*engine.Contract{c}, []string{"pre-commit"}, t.TempDir())
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
}
