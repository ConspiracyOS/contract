package engine

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// Environment captures the execution context for the report preamble.
type Environment struct {
	OS             string
	Cwd            string
	User           string
	AvailableTools []string
}

// DetectEnvironment auto-detects the current execution environment.
func DetectEnvironment() Environment {
	env := Environment{
		OS:   detectOS(),
		Cwd:  detectCwd(),
		User: detectUser(),
	}
	env.AvailableTools = detectTools()
	return env
}

func detectOS() string {
	if runtime.GOOS != "linux" {
		return runtime.GOOS
	}
	// Try /etc/os-release for distro name
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "linux"
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			name := strings.TrimPrefix(line, "PRETTY_NAME=")
			name = strings.Trim(name, `"`)
			return "linux (" + strings.ToLower(name) + ")"
		}
	}
	return "linux"
}

func detectCwd() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	return cwd
}

func detectUser() string {
	if u := os.Getenv("USER"); u != "" {
		return u
	}
	if u := os.Getenv("LOGNAME"); u != "" {
		return u
	}
	return "unknown"
}

// toolCandidates is the list checked for availability.
var toolCandidates = []string{
	"git", "go", "python3", "python", "node", "npm", "bun",
	"docker", "kubectl", "mix", "cargo", "ruby",
}

func detectTools() []string {
	var found []string
	for _, tool := range toolCandidates {
		if _, err := exec.LookPath(tool); err == nil {
			found = append(found, tool)
		}
	}
	return found
}

// FormatEnvironment renders the environment preamble for a brief report.
func FormatEnvironment(env Environment) string {
	var b strings.Builder
	fmt.Fprintf(&b, "## Environment\n")
	fmt.Fprintf(&b, "- OS: %s\n", env.OS)
	fmt.Fprintf(&b, "- Working directory: %s\n", env.Cwd)
	fmt.Fprintf(&b, "- User: %s\n", env.User)
	if len(env.AvailableTools) > 0 {
		fmt.Fprintf(&b, "- Available: %s\n", strings.Join(env.AvailableTools, ", "))
	}
	return b.String()
}
