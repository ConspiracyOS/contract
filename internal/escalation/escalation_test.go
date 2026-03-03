package escalation_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
	"github.com/ConspiracyOS/contracts/internal/escalation"
)

func resultWith(onFail engine.OnFail, status engine.CheckStatus) engine.AuditResult {
	return engine.AuditResult{
		Results: []engine.CheckResult{{
			ContractID: "T-001",
			CheckName:  "check",
			Status:     status,
			OnFail:     onFail,
			Message:    "test failure",
		}},
	}
}

func TestDispatch_NoCommand(t *testing.T) {
	// Empty command — must not panic or exec anything
	escalation.Dispatch("", resultWith(engine.OnFailEscalate, engine.StatusFail))
}

func TestDispatch_NoEscalateFailures(t *testing.T) {
	// plain fail — no escalate/alert OnFail → dispatch not called
	out := filepath.Join(t.TempDir(), "out.json")
	cmd := "cat > " + out
	result := resultWith(engine.OnFailFail, engine.StatusFail)
	escalation.Dispatch(cmd, result)
	if _, err := os.Stat(out); err == nil {
		t.Fatal("expected no output file — dispatch should not run for plain fail")
	}
}

func TestDispatch_EscalateFailure_WritesPayload(t *testing.T) {
	out := filepath.Join(t.TempDir(), "payload.json")
	cmd := "cat > " + out
	result := resultWith(engine.OnFailEscalate, engine.StatusFail)
	escalation.Dispatch(cmd, result)

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("expected output file: %v", err)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("expected valid JSON payload: %v", err)
	}
	if payload["severity"] != "escalate" {
		t.Errorf("expected severity=escalate, got %v", payload["severity"])
	}
	if payload["summary"] == "" {
		t.Error("expected non-empty summary")
	}
}

func TestDispatch_AlertFailure_SeverityAlert(t *testing.T) {
	out := filepath.Join(t.TempDir(), "payload.json")
	cmd := "cat > " + out
	result := resultWith(engine.OnFailAlert, engine.StatusWarn)
	escalation.Dispatch(cmd, result)

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("expected output file: %v", err)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("expected valid JSON payload: %v", err)
	}
	if payload["severity"] != "alert" {
		t.Errorf("expected severity=alert, got %v", payload["severity"])
	}
}

func TestDispatch_EscalateBeatAlert(t *testing.T) {
	// mixed escalate + alert → severity must be "escalate"
	out := filepath.Join(t.TempDir(), "payload.json")
	cmd := "cat > " + out
	result := engine.AuditResult{
		Results: []engine.CheckResult{
			{ContractID: "T-001", Status: engine.StatusWarn, OnFail: engine.OnFailAlert},
			{ContractID: "T-002", Status: engine.StatusFail, OnFail: engine.OnFailEscalate},
		},
	}
	escalation.Dispatch(cmd, result)

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("expected output file: %v", err)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("expected valid JSON payload: %v", err)
	}
	if payload["severity"] != "escalate" {
		t.Errorf("escalate should beat alert, got %v", payload["severity"])
	}
}

func TestDispatch_CommandFailure_NoExit(t *testing.T) {
	// bad command → prints to stderr, does not panic
	result := resultWith(engine.OnFailEscalate, engine.StatusFail)
	escalation.Dispatch("exit 99", result) // sh -c "exit 99" — exits non-zero
	// no assertion needed — just must not panic
}

func TestDispatch_PassedCheck_NotDispatched(t *testing.T) {
	// escalate check that PASSED → no dispatch
	out := filepath.Join(t.TempDir(), "out.json")
	cmd := "cat > " + out
	result := resultWith(engine.OnFailEscalate, engine.StatusPass)
	escalation.Dispatch(cmd, result)
	if _, err := os.Stat(out); err == nil {
		t.Fatal("dispatch should not run when escalate check passed")
	}
}
