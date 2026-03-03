package engine

import (
	"github.com/ConspiracyOS/contracts/internal/modules"
)

func isFileIndependent(check *Check) bool {
	return check.Command != nil || check.Script != nil ||
		check.CommandAvail != nil || check.EnvVar != nil || check.NoEnvVar != nil ||
		check.PathExists != nil || check.PathNotExists != nil
}

// RunAudit evaluates all contracts for the given trigger and returns aggregated results.
func RunAudit(contracts []*Contract, trigger Trigger, projectRoot string) AuditResult {
	var results []CheckResult

	for _, contract := range contracts {
		// Wrong trigger: skip all checks in this contract
		if contract.Trigger != trigger {
			for _, check := range contract.Checks {
				results = append(results, CheckResult{
					ContractID:          contract.ID,
					ContractDescription: contract.Description,
					CheckName:           check.Name,
					Status:              StatusSkip,
					Message:             "trigger mismatch",
				})
			}
			continue
		}

		// Contract-level skip_if
		if modules.EvaluateSkipIf(contract.SkipIf, projectRoot) {
			for _, check := range contract.Checks {
				results = append(results, CheckResult{
					ContractID:          contract.ID,
					ContractDescription: contract.Description,
					CheckName:           check.Name,
					Status:              StatusSkip,
					Message:             "contract skip_if condition met",
				})
			}
			continue
		}

		files, err := ResolveScope(contract.Scope, projectRoot)
		if err != nil || len(files) == 0 {
			files = []string{GlobalSentinel}
		}

		// Separate file-independent from file-specific checks
		var fiChecks, fsChecks []*Check
		for i := range contract.Checks {
			if isFileIndependent(&contract.Checks[i]) {
				fiChecks = append(fiChecks, &contract.Checks[i])
			} else {
				fsChecks = append(fsChecks, &contract.Checks[i])
			}
		}

		// File-independent: run once with representative file
		repr := files[0]
		for _, check := range fiChecks {
			results = append(results, RunCheck(contract, check, repr, projectRoot))
		}

		// File-specific: run per file
		for _, file := range files {
			for _, check := range fsChecks {
				results = append(results, RunCheck(contract, check, file, projectRoot))
			}
		}
	}

	return aggregate(results)
}

func aggregate(results []CheckResult) AuditResult {
	r := AuditResult{Results: results}
	for _, cr := range results {
		switch cr.Status {
		case StatusPass:
			r.Passed++
		case StatusFail:
			r.Failed++
		case StatusWarn:
			r.Warned++
		case StatusExempt:
			r.Exempt++
		case StatusSkip:
			r.Skipped++
		}
	}
	return r
}
