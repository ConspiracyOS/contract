package engine

import (
	"fmt"
	"sort"
	"strings"
)

var severityRank = map[string]int{
	"critical": 0,
	"high":     1,
	"medium":   2,
	"low":      3,
	"info":     4,
	"":         1, // default to high rank
}

// FormatBrief renders an agent-consumable findings report from an audit result.
func FormatBrief(result AuditResult, env Environment) string {
	// Collect actionable findings (failed + warned only)
	var findings []CheckResult
	for _, r := range result.Results {
		if r.Status == StatusFail || r.Status == StatusWarn {
			findings = append(findings, r)
		}
	}

	var b strings.Builder
	b.WriteString(FormatEnvironment(env))
	b.WriteString("\n")

	if len(findings) == 0 {
		fmt.Fprintf(&b, "## Findings\n\nNo issues found.\n")
		return b.String()
	}

	// Sort by severity rank
	sort.SliceStable(findings, func(i, j int) bool {
		ri := severityRank[findings[i].Severity]
		rj := severityRank[findings[j].Severity]
		return ri < rj
	})

	fmt.Fprintf(&b, "## Findings (%d issue", len(findings))
	if len(findings) != 1 {
		b.WriteString("s")
	}
	b.WriteString(")\n\n")

	for i, f := range findings {
		sev := f.Severity
		if sev == "" {
			sev = "high"
		}
		what := f.What
		if what == "" {
			what = f.ContractDescription
			if what == "" {
				what = f.CheckName
			}
		}

		fmt.Fprintf(&b, "### %d. [%s] %s (%s)\n", i+1, sev, what, f.ContractID)

		if len(f.Affects) > 0 {
			fmt.Fprintf(&b, "Affects: %s\n", strings.Join(f.Affects, ", "))
		}

		if f.Evidence != "" {
			b.WriteString("Evidence:\n")
			for _, line := range strings.Split(strings.TrimSpace(f.Evidence), "\n") {
				fmt.Fprintf(&b, "    %s\n", line)
			}
		}

		if f.Verify != "" {
			fmt.Fprintf(&b, "Verify: %s\n", f.Verify)
		}

		b.WriteString("\n")
	}

	return b.String()
}
