package engine_test

import (
	"strings"
	"testing"
	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestEnvironment_HasOS(t *testing.T) {
	env := engine.DetectEnvironment()
	if env.OS == "" {
		t.Fatal("expected non-empty OS")
	}
}

func TestEnvironment_HasCwd(t *testing.T) {
	env := engine.DetectEnvironment()
	if env.Cwd == "" {
		t.Fatal("expected non-empty Cwd")
	}
}

func TestFormatEnvironment(t *testing.T) {
	env := engine.Environment{
		OS:             "linux (debian 12)",
		Cwd:            "/srv/myproject",
		User:           "a-sysadmin",
		AvailableTools: []string{"git", "go"},
	}
	out := engine.FormatEnvironment(env)
	if !strings.Contains(out, "linux") {
		t.Errorf("expected OS in output, got: %s", out)
	}
	if !strings.Contains(out, "/srv/myproject") {
		t.Errorf("expected cwd in output, got: %s", out)
	}
	if !strings.Contains(out, "git") {
		t.Errorf("expected tools in output, got: %s", out)
	}
}
