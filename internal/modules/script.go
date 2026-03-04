package modules

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ConspiracyOS/contracts/internal/types"
)

// RunScript executes a script from a file path or inline content.
func RunScript(c *types.ScriptCheck, cwd string) Result {
	scriptPath := c.Path

	if c.Inline != "" {
		tmp, err := os.CreateTemp("", "contracts-script-*.sh")
		if err != nil {
			return Result{false, fmt.Sprintf("creating temp script: %v", err), ""}
		}
		defer os.Remove(tmp.Name())
		if _, err := tmp.WriteString("#!/bin/sh\n" + c.Inline); err != nil {
			tmp.Close()
			return Result{false, fmt.Sprintf("writing temp script: %v", err), ""}
		}
		if err := tmp.Close(); err != nil {
			return Result{false, fmt.Sprintf("closing temp script: %v", err), ""}
		}
		os.Chmod(tmp.Name(), 0755)
		scriptPath = tmp.Name()
	}

	timeout := 120 * time.Second
	if c.Timeout != "" {
		if secs, err := strconv.Atoi(strings.TrimSuffix(c.Timeout, "s")); err == nil {
			timeout = time.Duration(secs) * time.Second
		}
	}

	if !filepath.IsAbs(scriptPath) {
		scriptPath = filepath.Join(cwd, scriptPath)
	}

	cmd := exec.Command(scriptPath)
	cmd.Dir = cwd

	done := make(chan error, 1)
	var out []byte
	go func() {
		var err error
		out, err = cmd.Output()
		done <- err
	}()

	select {
	case err := <-done:
		stdout := strings.TrimSpace(string(out))
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				msg := strings.TrimSpace(string(exitErr.Stderr))
				if msg == "" {
					msg = fmt.Sprintf("exit code %d", exitErr.ExitCode())
				}
				return Result{false, msg, stdout}
			}
			return Result{false, err.Error(), ""}
		}
		return Result{Pass: true, Reason: stdout, Evidence: stdout}
	case <-time.After(timeout):
		cmd.Process.Kill()
		return Result{false, fmt.Sprintf("timed out after %s", timeout), ""}
	}
}
