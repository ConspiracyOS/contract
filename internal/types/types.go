// Package types contains shared check-input structs used by both the engine
// and the modules packages. It has no dependencies on either, which allows
// engine to import modules and modules to import engine without a cycle.
package types

// Result is the outcome of a single module check.
type Result struct {
	Pass   bool
	Reason string
}

// CommandCheck defines a shell command check.
type CommandCheck struct {
	Run           string `yaml:"run"`
	ExitCode      int    `yaml:"exit_code"`
	OutputMatches string `yaml:"output_matches"`
}

// ScriptCheck defines a script-file or inline-script check.
type ScriptCheck struct {
	Path    string `yaml:"path"`
	Inline  string `yaml:"inline"`
	Timeout string `yaml:"timeout"`
}

// RegexCheck defines a regex pattern check.
type RegexCheck struct {
	Pattern string `yaml:"pattern"`
}

// PathType constrains path_exists checks.
type PathType string

const (
	PathTypeFile      PathType = "file"
	PathTypeDirectory PathType = "directory"
)

// PathCheck defines a path-existence check.
type PathCheck struct {
	Path string   `yaml:"path"`
	Type PathType `yaml:"type"`
}

// KeyCheck defines a config-file key check (yaml/json/toml).
type KeyCheck struct {
	Path    string `yaml:"path"`
	Key     string `yaml:"key"`
	Equals  string `yaml:"equals"`
	Matches string `yaml:"matches"`
	Exists  *bool  `yaml:"exists"`
}

// EnvVarCheck defines an environment variable check.
type EnvVarCheck struct {
	Name    string `yaml:"name"`
	Equals  string `yaml:"equals"`
	Matches string `yaml:"matches"`
}

// CommandAvailCheck defines a command-availability check.
type CommandAvailCheck struct {
	Name string `yaml:"name"`
}

// SkipIf defines conditions under which a check is skipped.
type SkipIf struct {
	EnvVarUnset         string `yaml:"env_var_unset"`
	PathNotExists       string `yaml:"path_not_exists"`
	NotInCI             bool   `yaml:"not_in_ci"`
	CommandNotAvailable string `yaml:"command_not_available"`
}
