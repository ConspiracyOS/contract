package modules

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"

	"github.com/ConspiracyOS/contracts/internal/types"
)

// Result is an alias for types.Result for package-local convenience.
type Result = types.Result

// RunCommand executes a shell command and checks its exit code and optional output.
func RunCommand(c *types.CommandCheck, cwd string) Result {
	cmd := exec.Command("sh", "-c", c.Run)
	cmd.Dir = cwd
	out, err := cmd.Output()
	stdout := strings.TrimSpace(string(out))

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return Result{false, fmt.Sprintf("exec error: %v", err), ""}
		}
	}

	expected := c.ExitCode // default 0
	if exitCode != expected {
		return Result{false, fmt.Sprintf("exit code %d (expected %d)", exitCode, expected), stdout}
	}

	if c.OutputMatches != "" {
		re, err := regexp.Compile(c.OutputMatches)
		if err != nil {
			return Result{false, fmt.Sprintf("invalid output_matches regex: %v", err), stdout}
		}
		if !re.MatchString(stdout) {
			return Result{false, fmt.Sprintf("output %q did not match /%s/", stdout, c.OutputMatches), stdout}
		}
	}

	return Result{Pass: true, Evidence: stdout}
}
