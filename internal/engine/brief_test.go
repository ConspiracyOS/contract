package engine_test

import (
	"strings"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func briefResult(id, what, severity, category, verify, evidence string, affects []string, status engine.CheckStatus) engine.CheckResult {
	return engine.CheckResult{
		ContractID: id,
		CheckName:  "check",
		Status:     status,
		What:       what,
		Severity:   severity,
		Category:   category,
		Verify:     verify,
		Evidence:   evidence,
		Affects:    affects,
	}
}

func TestFormatBrief_OnlyFailed(t *testing.T) {
	results := []engine.CheckResult{
		briefResult("C-001", "Disk above 85%", "critical", "performance", "df /", "92%", []string{"/"}, engine.StatusFail),
		briefResult("C-002", "All good", "high", "config", "", "", nil, engine.StatusPass),
	}
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Results: results, Failed: 1, Passed: 1}, env)

	if !strings.Contains(out, "C-001") {
		t.Error("expected failed contract in report")
	}
	if strings.Contains(out, "C-002") {
		t.Error("passing contract must not appear in report")
	}
}

func TestFormatBrief_IncludesEvidence(t *testing.T) {
	results := []engine.CheckResult{
		briefResult("C-001", "Disk above 85%", "critical", "performance", "df /", "Filesystem  Use%\n/dev/sda1    92%", []string{"/"}, engine.StatusFail),
	}
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Results: results, Failed: 1}, env)

	if !strings.Contains(out, "92%") {
		t.Error("expected evidence in output")
	}
}

func TestFormatBrief_IncludesVerify(t *testing.T) {
	results := []engine.CheckResult{
		briefResult("C-001", "what", "high", "config", "echo verify_cmd", "", nil, engine.StatusFail),
	}
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Results: results, Failed: 1}, env)

	if !strings.Contains(out, "verify_cmd") {
		t.Error("expected verify command in output")
	}
}

func TestFormatBrief_IncludesWarnFindings(t *testing.T) {
	results := []engine.CheckResult{
		briefResult("C-001", "something warned", "medium", "config", "", "", nil, engine.StatusWarn),
	}
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Results: results, Warned: 1}, env)

	if !strings.Contains(out, "C-001") {
		t.Error("expected warn finding in report")
	}
}

func TestFormatBrief_EmptyReport(t *testing.T) {
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Passed: 3}, env)
	if !strings.Contains(out, "No issues") {
		t.Errorf("expected clean report message, got: %s", out)
	}
}

func TestFormatBrief_SeverityOrder(t *testing.T) {
	results := []engine.CheckResult{
		briefResult("C-LOW", "low thing", "low", "config", "", "", nil, engine.StatusFail),
		briefResult("C-CRIT", "critical thing", "critical", "config", "", "", nil, engine.StatusFail),
		briefResult("C-HIGH", "high thing", "high", "config", "", "", nil, engine.StatusFail),
	}
	env := engine.Environment{OS: "linux", Cwd: "/app", User: "root"}
	out := engine.FormatBrief(engine.AuditResult{Results: results, Failed: 3}, env)

	critPos := strings.Index(out, "C-CRIT")
	highPos := strings.Index(out, "C-HIGH")
	lowPos := strings.Index(out, "C-LOW")
	if critPos >= highPos || highPos >= lowPos {
		t.Error("expected critical before high before low")
	}
}
