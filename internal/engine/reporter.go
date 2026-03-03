package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

var statusLabel = map[CheckStatus]string{
	StatusPass:   "PASS  ",
	StatusFail:   "FAIL  ",
	StatusWarn:   "WARN  ",
	StatusExempt: "EXEMPT",
	StatusSkip:   "SKIP  ",
}

// FormatText returns a human-readable audit report.
// verbose=true shows per-file results; false collapses to per-contract.
func FormatText(result AuditResult, verbose bool) string {
	var b strings.Builder
	b.WriteString("\n=== contracts audit ===\n\n")

	// Group by contract: worst status wins
	seen := map[string]CheckStatus{}
	msgs := map[string]string{}
	for _, r := range result.Results {
		prev, ok := seen[r.ContractID]
		if !ok {
			seen[r.ContractID] = r.Status
			msgs[r.ContractID] = r.ContractDescription
			if r.Message != "" {
				msgs[r.ContractID] += "  — " + r.Message
			}
			continue
		}
		if worse(r.Status, prev) {
			seen[r.ContractID] = r.Status
			if r.Message != "" {
				msgs[r.ContractID] = r.ContractDescription + "  — " + r.Message
			}
		}
	}

	for id, status := range seen {
		label := statusLabel[status]
		fmt.Fprintf(&b, "%s  %s  %s\n", id, label, msgs[id])
	}

	fmt.Fprintf(&b, "\n=== %d passed, %d failed, %d warned, %d exempt, %d skipped ===\n",
		result.Passed, result.Failed, result.Warned, result.Exempt, result.Skipped)
	return b.String()
}

func worse(a, b CheckStatus) bool {
	rank := map[CheckStatus]int{
		StatusFail: 4, StatusWarn: 3, StatusExempt: 2, StatusSkip: 1, StatusPass: 0,
	}
	return rank[a] > rank[b]
}

// FormatJSON returns the audit result as pretty-printed JSON.
func FormatJSON(result AuditResult) string {
	out, _ := json.MarshalIndent(result, "", "  ")
	return string(out)
}
