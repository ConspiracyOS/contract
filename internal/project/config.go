package project

// Config represents .contracts/config.yaml
type Config struct {
	MinVersion string         `yaml:"min_version"` // minimum contracts version required, e.g. "0.2"
	Stack      []string       `yaml:"stack"`
	Contracts  *ContractsCfg  `yaml:"contracts"`
	Escalation *EscalationCfg `yaml:"escalation"`
}

type EscalationCfg struct {
	Command string `yaml:"command"`
}


type ContractsCfg struct {
	RequireCoverage *bool    `yaml:"require_coverage"`
	CoveragePaths   []string `yaml:"coverage_paths"`
}
