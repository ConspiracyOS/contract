package engine

import "github.com/ConspiracyOS/contracts/internal/types"

// Re-export shared check-input types from internal/types.
// This allows engine to import modules (which import types) without a cycle.
type (
	Result            = types.Result
	CommandCheck      = types.CommandCheck
	ScriptCheck       = types.ScriptCheck
	RegexCheck        = types.RegexCheck
	PathType          = types.PathType
	PathCheck         = types.PathCheck
	KeyCheck          = types.KeyCheck
	EnvVarCheck       = types.EnvVarCheck
	CommandAvailCheck = types.CommandAvailCheck
	SkipIf            = types.SkipIf
)

// Re-export PathType constants.
const (
	PathTypeFile      = types.PathTypeFile
	PathTypeDirectory = types.PathTypeDirectory
)

// ContractType is display-only metadata.
type ContractType string

const (
	TypeAtomic    ContractType = "atomic"
	TypeDetective ContractType = "detective"
	TypeHolistic  ContractType = "holistic"
	TypeProtocol  ContractType = "protocol"
)

// OnFail action string — evaluator maps to context-appropriate behaviour.
type OnFail string

const (
	OnFailFail             OnFail = "fail"
	OnFailWarn             OnFail = "warn"
	OnFailRequireExemption OnFail = "require_exemption"
	OnFailEscalate         OnFail = "escalate"    // ConspiracyOS: escalate to sysadmin
	OnFailHaltAgents       OnFail = "halt_agents" // ConspiracyOS: halt all agents
	OnFailAlert            OnFail = "alert"        // ConspiracyOS: alert
	OnFailHalt             OnFail = "halt"         // Protocol: block the action
)

// DefaultSeverity derives a severity string from an on_fail action.
func DefaultSeverity(onFail OnFail) string {
	switch onFail {
	case OnFailHaltAgents, OnFailHalt:
		return "critical"
	case OnFailFail, OnFailEscalate:
		return "high"
	case OnFailWarn, OnFailAlert:
		return "medium"
	case OnFailRequireExemption:
		return "low"
	default:
		return "high"
	}
}

type Scope struct {
	Global  bool
	Paths   []string
	Exclude []string
}

// Check is a single assertion within a contract.
// Exactly one check module field should be set.
type Check struct {
	Name   string  `yaml:"name"`
	OnFail OnFail  `yaml:"on_fail"`
	SkipIf *SkipIf `yaml:"skip_if"`

	// Brief-mode fields (optional). All omitted for existing contracts.
	Severity string   `yaml:"severity,omitempty"` // critical|high|medium|low|info
	Category string   `yaml:"category,omitempty"` // integrity|security|config|performance|network
	What     string   `yaml:"what,omitempty"`     // factual observation (no interpretation)
	Verify   string   `yaml:"verify,omitempty"`   // read-only verification command
	Affects  []string `yaml:"affects,omitempty"`  // paths, services, resources

	// Check modules (exactly one should be set)
	Command       *CommandCheck      `yaml:"command"`
	Script        *ScriptCheck       `yaml:"script"`
	RegexInFile   *RegexCheck        `yaml:"regex_in_file"`
	NoRegexInFile *RegexCheck        `yaml:"no_regex_in_file"`
	PathExists    *PathCheck         `yaml:"path_exists"`
	PathNotExists *PathCheck         `yaml:"path_not_exists"`
	YAMLKey       *KeyCheck          `yaml:"yaml_key"`
	JSONKey       *KeyCheck          `yaml:"json_key"`
	TOMLKey       *KeyCheck          `yaml:"toml_key"`
	EnvVar        *EnvVarCheck       `yaml:"env_var"`
	NoEnvVar      *EnvVarCheck       `yaml:"no_env_var"`
	CommandAvail  *CommandAvailCheck `yaml:"command_available"`
}

type Contract struct {
	ID          string       `yaml:"id"`
	Description string       `yaml:"description"`
	Type        ContractType `yaml:"type"`
	Trigger     string       `yaml:"trigger,omitempty"` // protocol contracts: descriptive label for the gated action
	Tags        []string     `yaml:"-"`                 // custom unmarshal (scalar or list)
	Scope       Scope        `yaml:"-"`                 // custom unmarshal
	SkipIf      *SkipIf      `yaml:"skip_if"`
	Checks      []Check      `yaml:"checks"`
	Builtin     bool         `yaml:"-"` // set by loader, not in YAML
	System      bool         `yaml:"-"` // set by loader for ~/.config/contracts entries
	DependsOn   []string     `yaml:"depends_on,omitempty"` // contract IDs whose failures must be addressed first
}

// CheckStatus is the outcome of a single check evaluation.
type CheckStatus string

const (
	StatusPass   CheckStatus = "pass"
	StatusFail   CheckStatus = "fail"
	StatusWarn   CheckStatus = "warn"
	StatusExempt CheckStatus = "exempt"
	StatusSkip   CheckStatus = "skip"
	StatusHalt   CheckStatus = "halt" // protocol contracts: action must not proceed
)

type CheckResult struct {
	ContractID          string      `json:"contract_id"`
	ContractDescription string      `json:"contract_description"`
	CheckName           string      `json:"check_name"`
	Status              CheckStatus `json:"status"`
	Message             string      `json:"message"`
	File                string      `json:"file,omitempty"`
	OnFail              OnFail      `json:"on_fail,omitempty"`
	Evidence            string      `json:"evidence,omitempty"`  // auto-captured stdout from check run
	Severity            string      `json:"severity,omitempty"`  // derived or explicit
	Category            string      `json:"category,omitempty"`
	What                string      `json:"what,omitempty"`
	Verify              string      `json:"verify,omitempty"`
	Affects             []string    `json:"affects,omitempty"`
}

type AuditResult struct {
	Results []CheckResult `json:"results"`
	Passed  int           `json:"passed"`
	Failed  int           `json:"failed"`
	Warned  int           `json:"warned"`
	Exempt  int           `json:"exempt"`
	Skipped int           `json:"skipped"`
	Halted  int           `json:"halted,omitempty"`
}
