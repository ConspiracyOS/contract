package escalation

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

// Payload is piped to stdin of the escalation command as JSON.
type Payload struct {
	Severity string               `json:"severity"`
	Summary  string               `json:"summary"`
	Failures []engine.CheckResult `json:"failures"`
}

// Dispatch runs command via "sh -c <command>" when any escalate or alert check
// failed. Best-effort: errors are printed to stderr; the caller's exit code is
// unaffected. No-op if command is empty or no qualifying failures exist.
func Dispatch(command string, result engine.AuditResult) {
	if command == "" {
		return
	}

	// halt_agents is a separate action handled by the ConspiracyOS runtime,
	// not dispatched via this escalation hook.
	var failures []engine.CheckResult
	for _, r := range result.Results {
		if r.OnFail != engine.OnFailEscalate && r.OnFail != engine.OnFailAlert {
			continue
		}
		// Skip and pass are both non-failures: skipped means the check precondition
		// was not met (e.g. command not available), not that the system is degraded.
		if r.Status == engine.StatusPass || r.Status == engine.StatusSkip {
			continue
		}
		failures = append(failures, r)
	}
	if len(failures) == 0 {
		return
	}

	// Escalate beats alert.
	severity := "alert"
	for _, f := range failures {
		if f.OnFail == engine.OnFailEscalate {
			severity = "escalate"
			break
		}
	}

	// Deduplicated contract IDs for the summary line.
	seen := map[string]bool{}
	var ids []string
	for _, f := range failures {
		if !seen[f.ContractID] {
			ids = append(ids, f.ContractID)
			seen[f.ContractID] = true
		}
	}
	summary := fmt.Sprintf("%d %s failure(s): %s",
		len(failures), severity, strings.Join(ids, ", "))

	data, err := json.Marshal(Payload{
		Severity: severity,
		Summary:  summary,
		Failures: failures,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: escalation: marshal payload: %v\n", err)
		return
	}

	cmd := exec.Command("sh", "-c", command)
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = os.Stderr // route to stderr so audit stdout stays clean (safe for --json)
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(),
		"CONTRACTS_SEVERITY="+severity,
		"CONTRACTS_SUMMARY="+summary,
	)

	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "warn: escalation command failed: %v\n", err)
	}
}
