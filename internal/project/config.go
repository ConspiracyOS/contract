package project

// Config represents .agent/config.yaml
type Config struct {
	Stack       []string      `yaml:"stack"`
	Opinionated *Opinionated  `yaml:"opinionated"`
	Contracts   *ContractsCfg `yaml:"contracts"`
}

type Opinionated struct {
	Presets []string `yaml:"presets"`
}

type ContractsCfg struct {
	RequireCoverage *bool    `yaml:"require_coverage"`
	CoveragePaths   []string `yaml:"coverage_paths"`
}
