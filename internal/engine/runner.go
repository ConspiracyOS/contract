package engine

import (
	"path/filepath"

	"github.com/ConspiracyOS/contracts/internal/modules"
)

// RunCheck evaluates a single check against a file (or GlobalSentinel for global checks).
func RunCheck(contract *Contract, check *Check, file, projectRoot string) CheckResult {
	// OnFail carries the raw config value (may be "" if unset).
	// Dispatch logic below normalises "" to OnFailFail; consumers of CheckResult
	// must not treat "" as equivalent to OnFailFail — use the Status field instead.
	base := CheckResult{
		ContractID:          contract.ID,
		ContractDescription: contract.Description,
		CheckName:           check.Name,
		File:                file,
		OnFail:              check.OnFail,
	}

	// Propagate brief-mode fields
	base.Severity = check.Severity
	if base.Severity == "" {
		base.Severity = DefaultSeverity(check.OnFail)
	}
	base.Category = check.Category
	base.What     = check.What
	base.Verify   = check.Verify
	base.Affects  = check.Affects

	if modules.EvaluateSkipIf(check.SkipIf, projectRoot) {
		base.Status = StatusSkip
		base.Message = "skip_if condition met"
		return base
	}

	result := dispatch(check, file, projectRoot)
	base.Evidence = result.Evidence

	if result.Pass {
		base.Status = StatusPass
		base.Message = result.Reason
		return base
	}

	onFail := check.OnFail
	if onFail == "" {
		onFail = OnFailFail
	}

	// require_exemption: check for inline exemption comment
	if onFail == OnFailRequireExemption && file != GlobalSentinel {
		if reason, ok := modules.FindExemption(file, contract.ID); ok {
			base.Status = StatusExempt
			base.Message = reason
			return base
		}
	}

	// halt: protocol contracts — action must not proceed
	if onFail == OnFailHalt {
		base.Status = StatusHalt
		base.Message = result.Reason
		return base
	}

	// warn-level actions: warn, alert
	if onFail == OnFailWarn || onFail == OnFailAlert {
		base.Status = StatusWarn
		base.Message = result.Reason
		return base
	}

	// All other actions (fail, escalate, halt_agents, require_exemption without exemption)
	base.Status = StatusFail
	base.Message = result.Reason
	return base
}

func dispatch(check *Check, file, cwd string) modules.Result {
	switch {
	case check.Command != nil:
		return modules.RunCommand(check.Command, cwd)
	case check.Script != nil:
		return modules.RunScript(check.Script, cwd)
	case check.RegexInFile != nil:
		if file == GlobalSentinel {
			return modules.Result{Pass: false, Reason: "regex_in_file requires file scope, got global"}
		}
		return modules.CheckRegexInFile(file, check.RegexInFile.Pattern)
	case check.NoRegexInFile != nil:
		if file == GlobalSentinel {
			return modules.Result{Pass: true}
		}
		return modules.CheckNoRegexInFile(file, check.NoRegexInFile.Pattern)
	case check.PathExists != nil:
		path := check.PathExists.Path
		if !filepath.IsAbs(path) {
			path = filepath.Join(cwd, path)
		}
		return modules.CheckPathExists(path, check.PathExists.Type)
	case check.PathNotExists != nil:
		path := check.PathNotExists.Path
		if !filepath.IsAbs(path) {
			path = filepath.Join(cwd, path)
		}
		return modules.CheckPathNotExists(path)
	case check.YAMLKey != nil:
		return modules.CheckKeyFile(filepath.Join(cwd, check.YAMLKey.Path), "yaml", check.YAMLKey)
	case check.JSONKey != nil:
		return modules.CheckKeyFile(filepath.Join(cwd, check.JSONKey.Path), "json", check.JSONKey)
	case check.TOMLKey != nil:
		return modules.CheckKeyFile(filepath.Join(cwd, check.TOMLKey.Path), "toml", check.TOMLKey)
	case check.EnvVar != nil:
		return modules.CheckEnvVar(check.EnvVar)
	case check.NoEnvVar != nil:
		return modules.CheckNoEnvVar(check.NoEnvVar)
	case check.CommandAvail != nil:
		return modules.CheckCommandAvailable(check.CommandAvail)
	default:
		return modules.Result{Pass: false, Reason: "no check module specified"}
	}
}
