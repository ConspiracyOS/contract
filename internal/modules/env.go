package modules

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"

	"github.com/ConspiracyOS/contracts/internal/types"
)

// CheckEnvVar returns pass if the named environment variable is set, optionally
// matching an exact value or regex pattern.
func CheckEnvVar(c *types.EnvVarCheck) Result {
	val, ok := os.LookupEnv(c.Name)
	if !ok {
		return Result{false, fmt.Sprintf("env var %s is not set", c.Name)}
	}
	if c.Equals != "" && val != c.Equals {
		return Result{false, fmt.Sprintf("env var %s=%q, expected %q", c.Name, val, c.Equals)}
	}
	if c.Matches != "" {
		re, err := regexp.Compile(c.Matches)
		if err != nil {
			return Result{false, fmt.Sprintf("invalid matches regex: %v", err)}
		}
		if !re.MatchString(val) {
			return Result{false, fmt.Sprintf("env var %s=%q does not match /%s/", c.Name, val, c.Matches)}
		}
	}
	return Result{Pass: true}
}

// CheckNoEnvVar returns pass if the named environment variable is not set, or
// is set but does not match the optional pattern.
func CheckNoEnvVar(c *types.EnvVarCheck) Result {
	val, ok := os.LookupEnv(c.Name)
	if !ok {
		return Result{Pass: true}
	}
	if c.Matches != "" {
		re, err := regexp.Compile(c.Matches)
		if err != nil {
			return Result{false, fmt.Sprintf("invalid matches regex: %v", err)}
		}
		if !re.MatchString(val) {
			return Result{Pass: true}
		}
		return Result{false, fmt.Sprintf("env var %s is set and matches /%s/", c.Name, c.Matches)}
	}
	return Result{false, fmt.Sprintf("env var %s should not be set", c.Name)}
}

// CheckCommandAvailable returns pass if the named binary is found in PATH.
func CheckCommandAvailable(c *types.CommandAvailCheck) Result {
	if _, err := exec.LookPath(c.Name); err != nil {
		return Result{false, fmt.Sprintf("command not found: %s", c.Name)}
	}
	return Result{Pass: true}
}
