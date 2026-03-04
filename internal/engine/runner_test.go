package engine_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func contractWith(check engine.Check) *engine.Contract {
	return &engine.Contract{
		ID: "T-001", Description: "test",
		Tags:  []string{"pre-commit"},
		Scope: engine.Scope{Global: true},
		Checks: []engine.Check{check},
	}
}

func TestRunner_CommandPass(t *testing.T) {
	c := contractWith(engine.Check{
		Name:    "true",
		OnFail:  engine.OnFailFail,
		Command: &engine.CommandCheck{Run: "true"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_CommandFail(t *testing.T) {
	c := contractWith(engine.Check{
		Name:    "false",
		OnFail:  engine.OnFailFail,
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusFail {
		t.Fatalf("expected fail, got %s", result.Status)
	}
}

func TestRunner_Warn(t *testing.T) {
	c := contractWith(engine.Check{
		Name:    "warn",
		OnFail:  engine.OnFailWarn,
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusWarn {
		t.Fatalf("expected warn, got %s", result.Status)
	}
}

// dispatch() — one test per check module type

func TestRunner_Script_Pass(t *testing.T) {
	c := contractWith(engine.Check{
		Name:   "script",
		OnFail: engine.OnFailFail,
		Script: &engine.ScriptCheck{Inline: "exit 0"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_RegexInFile_Pass(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "src.go")
	os.WriteFile(f, []byte("// TODO: old\n"), 0644)
	c := contractWith(engine.Check{
		Name:        "regex",
		OnFail:      engine.OnFailFail,
		RegexInFile: &engine.RegexCheck{Pattern: "TODO"},
	})
	result := engine.RunCheck(c, &c.Checks[0], f, dir)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_RegexInFile_GlobalSentinel(t *testing.T) {
	c := contractWith(engine.Check{
		Name:        "regex",
		OnFail:      engine.OnFailFail,
		RegexInFile: &engine.RegexCheck{Pattern: "TODO"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusFail {
		t.Fatalf("expected fail for regex_in_file on global sentinel, got %s", result.Status)
	}
}

func TestRunner_NoRegexInFile_Pass(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "clean.go")
	os.WriteFile(f, []byte("package main\n"), 0644)
	c := contractWith(engine.Check{
		Name:          "noregex",
		OnFail:        engine.OnFailFail,
		NoRegexInFile: &engine.RegexCheck{Pattern: "TODO"},
	})
	result := engine.RunCheck(c, &c.Checks[0], f, dir)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_NoRegexInFile_Fail(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "dirty.go")
	os.WriteFile(f, []byte("// TODO: fix\n"), 0644)
	c := contractWith(engine.Check{
		Name:          "noregex",
		OnFail:        engine.OnFailFail,
		NoRegexInFile: &engine.RegexCheck{Pattern: "TODO"},
	})
	result := engine.RunCheck(c, &c.Checks[0], f, dir)
	if result.Status != engine.StatusFail {
		t.Fatalf("expected fail, got %s", result.Status)
	}
}

func TestRunner_NoRegexInFile_GlobalSentinel(t *testing.T) {
	// no_regex_in_file on global scope → always pass (no file to scan)
	c := contractWith(engine.Check{
		Name:          "noregex",
		OnFail:        engine.OnFailFail,
		NoRegexInFile: &engine.RegexCheck{Pattern: "TODO"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass for no_regex_in_file on global sentinel, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_PathExists_Abs(t *testing.T) {
	dir := t.TempDir()
	c := contractWith(engine.Check{
		Name:       "path",
		OnFail:     engine.OnFailFail,
		PathExists: &engine.PathCheck{Path: dir},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_PathExists_Relative(t *testing.T) {
	cwd := t.TempDir()
	os.WriteFile(filepath.Join(cwd, "README.md"), []byte("x"), 0644)
	c := contractWith(engine.Check{
		Name:       "path",
		OnFail:     engine.OnFailFail,
		PathExists: &engine.PathCheck{Path: "README.md"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, cwd)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_PathNotExists(t *testing.T) {
	c := contractWith(engine.Check{
		Name:          "notexist",
		OnFail:        engine.OnFailFail,
		PathNotExists: &engine.PathCheck{Path: "/tmp/contracts-test-absent-99999"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_YAMLKey(t *testing.T) {
	cwd := t.TempDir()
	os.WriteFile(filepath.Join(cwd, "config.yaml"), []byte("name: contracts\n"), 0644)
	c := contractWith(engine.Check{
		Name:    "yaml",
		OnFail:  engine.OnFailFail,
		YAMLKey: &engine.KeyCheck{Path: "config.yaml", Key: "name", Equals: "contracts"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, cwd)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_JSONKey(t *testing.T) {
	cwd := t.TempDir()
	os.WriteFile(filepath.Join(cwd, "package.json"), []byte(`{"name":"contracts"}`), 0644)
	c := contractWith(engine.Check{
		Name:    "json",
		OnFail:  engine.OnFailFail,
		JSONKey: &engine.KeyCheck{Path: "package.json", Key: "name", Equals: "contracts"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, cwd)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_TOMLKey(t *testing.T) {
	cwd := t.TempDir()
	os.WriteFile(filepath.Join(cwd, "cfg.toml"), []byte("[module]\npath = \"example\"\n"), 0644)
	c := contractWith(engine.Check{
		Name:    "toml",
		OnFail:  engine.OnFailFail,
		TOMLKey: &engine.KeyCheck{Path: "cfg.toml", Key: "module.path", Equals: "example"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, cwd)
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_EnvVar(t *testing.T) {
	t.Setenv("CONTRACTS_RUNNER_TEST_VAR", "ok")
	c := contractWith(engine.Check{
		Name:   "envvar",
		OnFail: engine.OnFailFail,
		EnvVar: &engine.EnvVarCheck{Name: "CONTRACTS_RUNNER_TEST_VAR"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_NoEnvVar(t *testing.T) {
	os.Unsetenv("CONTRACTS_RUNNER_NOENV_XYZ")
	c := contractWith(engine.Check{
		Name:     "noenv",
		OnFail:   engine.OnFailFail,
		NoEnvVar: &engine.EnvVarCheck{Name: "CONTRACTS_RUNNER_NOENV_XYZ"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_CommandAvail(t *testing.T) {
	c := contractWith(engine.Check{
		Name:         "avail",
		OnFail:       engine.OnFailFail,
		CommandAvail: &engine.CommandAvailCheck{Name: "sh"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusPass {
		t.Fatalf("expected pass, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_NoCheckModule(t *testing.T) {
	// Empty check → dispatch default → fail
	c := contractWith(engine.Check{Name: "empty", OnFail: engine.OnFailFail})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusFail {
		t.Fatalf("expected fail for empty check, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_RequireExemption_WithExemption(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "main.go")
	os.WriteFile(f, []byte("// @contract:T-001:exempt:legacy code\npackage main\n"), 0644)
	c := contractWith(engine.Check{
		Name:        "exempt",
		OnFail:      engine.OnFailRequireExemption,
		RegexInFile: &engine.RegexCheck{Pattern: "MISSING_PATTERN"},
	})
	result := engine.RunCheck(c, &c.Checks[0], f, dir)
	if result.Status != engine.StatusExempt {
		t.Fatalf("expected exempt, got %s: %s", result.Status, result.Message)
	}
}

func TestRunner_RequireExemption_NoExemption(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "main.go")
	os.WriteFile(f, []byte("package main\n"), 0644)
	c := contractWith(engine.Check{
		Name:        "exempt",
		OnFail:      engine.OnFailRequireExemption,
		RegexInFile: &engine.RegexCheck{Pattern: "MISSING_PATTERN"},
	})
	result := engine.RunCheck(c, &c.Checks[0], f, dir)
	if result.Status != engine.StatusFail {
		t.Fatalf("expected fail (no exemption present), got %s", result.Status)
	}
}

func TestRunner_Alert_Fail(t *testing.T) {
	c := contractWith(engine.Check{
		Name:    "alert",
		OnFail:  engine.OnFailAlert,
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusWarn {
		t.Fatalf("expected warn for OnFailAlert, got %s", result.Status)
	}
}

func TestRunner_SkipIf(t *testing.T) {
	c := contractWith(engine.Check{
		Name:   "skip",
		OnFail: engine.OnFailFail,
		SkipIf: &engine.SkipIf{CommandNotAvailable: "contracts-not-a-real-bin-xyz"},
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusSkip {
		t.Fatalf("expected skip, got %s", result.Status)
	}
}

func TestRunner_OnFail_CarriedThrough(t *testing.T) {
	// escalate → StatusFail, but OnFail must be OnFailEscalate
	c := contractWith(engine.Check{
		Name:    "esc",
		OnFail:  engine.OnFailEscalate,
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusFail {
		t.Fatalf("expected StatusFail, got %s", result.Status)
	}
	if result.OnFail != engine.OnFailEscalate {
		t.Fatalf("expected OnFail=escalate, got %q", result.OnFail)
	}
}

func TestRunner_Alert_OnFail_CarriedThrough(t *testing.T) {
	// alert → StatusWarn, OnFail must be OnFailAlert
	c := contractWith(engine.Check{
		Name:    "alrt",
		OnFail:  engine.OnFailAlert,
		Command: &engine.CommandCheck{Run: "false"},
	})
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, t.TempDir())
	if result.Status != engine.StatusWarn {
		t.Fatalf("expected StatusWarn, got %s", result.Status)
	}
	if result.OnFail != engine.OnFailAlert {
		t.Fatalf("expected OnFail=alert, got %q", result.OnFail)
	}
}

func TestRunCheck_PopulatesBriefFields(t *testing.T) {
	c := &engine.Contract{
		ID:          "TEST-001",
		Description: "test",
		Checks: []engine.Check{{
			Name:     "check",
			Severity: "critical",
			Category: "performance",
			What:     "Something is wrong",
			Verify:   "echo ok",
			Affects:  []string{"/tmp"},
			Command:  &engine.CommandCheck{Run: "echo 'evidence output'", ExitCode: 0},
			OnFail:   engine.OnFailFail,
		}},
	}
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, ".")
	if result.Severity != "critical" {
		t.Errorf("expected severity critical, got %q", result.Severity)
	}
	if result.What != "Something is wrong" {
		t.Errorf("expected what field propagated, got %q", result.What)
	}
	if result.Evidence == "" {
		t.Error("expected evidence from stdout")
	}
	if result.Verify != "echo ok" {
		t.Errorf("expected verify propagated, got %q", result.Verify)
	}
}

func TestRunCheck_DefaultSeverity(t *testing.T) {
	c := &engine.Contract{
		ID: "TEST-002",
		Checks: []engine.Check{{
			Name:    "check",
			Command: &engine.CommandCheck{Run: "false"},
			OnFail:  engine.OnFailFail,
			// No Severity set — should derive from on_fail
		}},
	}
	result := engine.RunCheck(c, &c.Checks[0], engine.GlobalSentinel, ".")
	if result.Severity != "high" {
		t.Errorf("expected high (derived from fail), got %q", result.Severity)
	}
}
