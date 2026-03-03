package engine_test

import (
	"strings"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestReporter_Text(t *testing.T) {
	result := engine.AuditResult{
		Results: []engine.CheckResult{
			{ContractID: "C-001", ContractDescription: "Disk free", CheckName: "disk", Status: engine.StatusPass},
			{ContractID: "C-002", ContractDescription: "No TODOs", CheckName: "scan", Status: engine.StatusFail, Message: "found TODO"},
		},
		Passed: 1, Failed: 1,
	}
	out := engine.FormatText(result, false)
	if !strings.Contains(out, "C-001") || !strings.Contains(out, "PASS") {
		t.Fatalf("expected PASS line for C-001: %s", out)
	}
	if !strings.Contains(out, "C-002") || !strings.Contains(out, "FAIL") {
		t.Fatalf("expected FAIL line for C-002: %s", out)
	}
	if !strings.Contains(out, "1 passed") {
		t.Fatalf("expected summary: %s", out)
	}
}

func TestReporter_Text_WorseStatus(t *testing.T) {
	// Two results for same contract: first pass, second fail → worse() picks fail
	result := engine.AuditResult{
		Results: []engine.CheckResult{
			{ContractID: "C-001", ContractDescription: "Multi-check", CheckName: "c1", Status: engine.StatusPass},
			{ContractID: "C-001", ContractDescription: "Multi-check", CheckName: "c2", Status: engine.StatusFail, Message: "bad"},
		},
		Passed: 0, Failed: 1,
	}
	out := engine.FormatText(result, false)
	if !strings.Contains(out, "FAIL") {
		t.Fatalf("expected FAIL (worse status wins): %s", out)
	}
}

func TestReporter_Text_WorseStatus_NoUpdate(t *testing.T) {
	// Two results for same contract: first fail, second pass → worse() keeps fail
	result := engine.AuditResult{
		Results: []engine.CheckResult{
			{ContractID: "C-001", ContractDescription: "Multi-check", CheckName: "c1", Status: engine.StatusFail, Message: "bad"},
			{ContractID: "C-001", ContractDescription: "Multi-check", CheckName: "c2", Status: engine.StatusPass},
		},
		Passed: 0, Failed: 1,
	}
	out := engine.FormatText(result, false)
	if !strings.Contains(out, "FAIL") {
		t.Fatalf("expected FAIL to remain: %s", out)
	}
}

func TestReporter_JSON(t *testing.T) {
	result := engine.AuditResult{Passed: 3, Failed: 0}
	out := engine.FormatJSON(result)
	if !strings.Contains(out, `"passed":3`) && !strings.Contains(out, `"passed": 3`) {
		t.Fatalf("unexpected JSON: %s", out)
	}
}
