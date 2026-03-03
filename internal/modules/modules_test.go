package modules_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
	"github.com/ConspiracyOS/contracts/internal/modules"
)

func TestRunCommand_Pass(t *testing.T) {
	result := modules.RunCommand(&engine.CommandCheck{Run: "true", ExitCode: 0}, t.TempDir())
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestRunCommand_Fail(t *testing.T) {
	result := modules.RunCommand(&engine.CommandCheck{Run: "false", ExitCode: 0}, t.TempDir())
	if result.Pass {
		t.Fatal("expected fail")
	}
}

func TestRunCommand_ExitCode(t *testing.T) {
	result := modules.RunCommand(&engine.CommandCheck{Run: "exit 2", ExitCode: 2}, t.TempDir())
	if !result.Pass {
		t.Fatalf("expected pass for exit 2: %s", result.Reason)
	}
}

func TestRunCommand_OutputMatches(t *testing.T) {
	result := modules.RunCommand(&engine.CommandCheck{
		Run: "echo hello", ExitCode: 0, OutputMatches: "hel+o",
	}, t.TempDir())
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestRunCommand_OutputMatchesFail(t *testing.T) {
	result := modules.RunCommand(&engine.CommandCheck{
		Run: "echo bye", ExitCode: 0, OutputMatches: "^hello",
	}, t.TempDir())
	if result.Pass {
		t.Fatal("expected fail: output should not match")
	}
}

func TestRunScript_Path(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "check.sh")
	os.WriteFile(script, []byte("#!/bin/sh\nexit 0"), 0755)
	result := modules.RunScript(&engine.ScriptCheck{Path: script}, dir)
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestRunScript_Inline(t *testing.T) {
	result := modules.RunScript(&engine.ScriptCheck{Inline: "exit 0"}, t.TempDir())
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestRunScript_InlineFail(t *testing.T) {
	result := modules.RunScript(&engine.ScriptCheck{Inline: "exit 1"}, t.TempDir())
	if result.Pass {
		t.Fatal("expected fail")
	}
}

func TestCheckRegexInFile_Match(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("// TODO: fix this"), 0644)
	result := modules.CheckRegexInFile(f, `TODO`)
	if !result.Pass {
		t.Fatal("expected pass")
	}
}

func TestCheckRegexInFile_NoMatch(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("clean code"), 0644)
	result := modules.CheckRegexInFile(f, `TODO`)
	if result.Pass {
		t.Fatal("expected fail")
	}
}

func TestCheckNoRegexInFile_Pass(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("clean code"), 0644)
	result := modules.CheckNoRegexInFile(f, `TODO`)
	if !result.Pass {
		t.Fatal("expected pass (no match = good)")
	}
}

func TestPathExists_File(t *testing.T) {
	f := filepath.Join(t.TempDir(), "x.txt")
	os.WriteFile(f, []byte("x"), 0644)
	result := modules.CheckPathExists(f, engine.PathTypeFile)
	if !result.Pass {
		t.Fatal("expected pass")
	}
}

func TestPathNotExists(t *testing.T) {
	result := modules.CheckPathNotExists("/tmp/contracts-test-nonexistent-12345")
	if !result.Pass {
		t.Fatal("expected pass")
	}
}

func TestEnvVar_Set(t *testing.T) {
	t.Setenv("CONTRACTS_TEST_VAR", "hello")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_TEST_VAR"})
	if !result.Pass {
		t.Fatal("expected pass")
	}
}

func TestEnvVar_NotSet(t *testing.T) {
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_TEST_VAR_UNSET_XYZ"})
	if result.Pass {
		t.Fatal("expected fail — var not set")
	}
}

func TestCommandAvailable(t *testing.T) {
	result := modules.CheckCommandAvailable(&engine.CommandAvailCheck{Name: "sh"})
	if !result.Pass {
		t.Fatal("sh should always be available")
	}
}

func TestCommandNotAvailable(t *testing.T) {
	result := modules.CheckCommandAvailable(&engine.CommandAvailCheck{Name: "contracts-definitely-not-a-real-binary-xyz"})
	if result.Pass {
		t.Fatal("expected fail")
	}
}

func TestYAMLKey_Exists(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("name: conspiracyos\nversion: 1"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "name", Equals: "conspiracyos"})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestYAMLKey_Missing(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("name: conspiracyos"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "version", Equals: "1"})
	if result.Pass {
		t.Fatal("expected fail — key missing")
	}
}

func TestJSONKey_Exists(t *testing.T) {
	f := filepath.Join(t.TempDir(), "p.json")
	os.WriteFile(f, []byte(`{"name":"contracts","version":"1.0.0"}`), 0644)
	result := modules.CheckKeyFile(f, "json", &engine.KeyCheck{Key: "name", Equals: "contracts"})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestTOMLKey_Exists(t *testing.T) {
	f := filepath.Join(t.TempDir(), "go.mod")
	os.WriteFile(f, []byte("[module]\npath = \"github.com/example\""), 0644)
	result := modules.CheckKeyFile(f, "toml", &engine.KeyCheck{Key: "module.path", Equals: "github.com/example"})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestFindExemption_Found(t *testing.T) {
	f := filepath.Join(t.TempDir(), "main.go")
	os.WriteFile(f, []byte("// @contract:C-001:exempt:legacy code\npackage main"), 0644)
	reason, ok := modules.FindExemption(f, "C-001")
	if !ok {
		t.Fatal("expected exemption found")
	}
	if reason != "legacy code" {
		t.Fatalf("unexpected reason: %s", reason)
	}
}

func TestFindExemption_NotFound(t *testing.T) {
	f := filepath.Join(t.TempDir(), "main.go")
	os.WriteFile(f, []byte("package main"), 0644)
	_, ok := modules.FindExemption(f, "C-001")
	if ok {
		t.Fatal("expected no exemption")
	}
}

func TestEvaluateSkipIf_EnvVarUnset(t *testing.T) {
	os.Unsetenv("CONTRACTS_SKIP_TEST_VAR_XYZ")
	skip := modules.EvaluateSkipIf(&engine.SkipIf{EnvVarUnset: "CONTRACTS_SKIP_TEST_VAR_XYZ"}, ".")
	if !skip {
		t.Fatal("expected skip=true when env var is unset")
	}
}

func TestEvaluateSkipIf_EnvVarSet(t *testing.T) {
	t.Setenv("CONTRACTS_SKIP_TEST_VAR_XYZ", "1")
	skip := modules.EvaluateSkipIf(&engine.SkipIf{EnvVarUnset: "CONTRACTS_SKIP_TEST_VAR_XYZ"}, ".")
	if skip {
		t.Fatal("expected skip=false when env var is set")
	}
}

func TestEvaluateSkipIf_Nil(t *testing.T) {
	if modules.EvaluateSkipIf(nil, ".") {
		t.Fatal("expected false for nil SkipIf")
	}
}

func TestEvaluateSkipIf_PathNotExists_Missing(t *testing.T) {
	dir := t.TempDir()
	skip := modules.EvaluateSkipIf(&engine.SkipIf{PathNotExists: "missing-file.txt"}, dir)
	if !skip {
		t.Fatal("expected skip=true when path does not exist")
	}
}

func TestEvaluateSkipIf_PathNotExists_Exists(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "present.txt"), []byte("x"), 0644)
	skip := modules.EvaluateSkipIf(&engine.SkipIf{PathNotExists: "present.txt"}, dir)
	if skip {
		t.Fatal("expected skip=false when path exists")
	}
}

func TestEvaluateSkipIf_NotInCI_NotSet(t *testing.T) {
	old, hadCI := os.LookupEnv("CI")
	os.Unsetenv("CI")
	defer func() {
		if hadCI {
			os.Setenv("CI", old)
		}
	}()
	skip := modules.EvaluateSkipIf(&engine.SkipIf{NotInCI: true}, ".")
	if !skip {
		t.Fatal("expected skip=true when not in CI")
	}
}

func TestEvaluateSkipIf_NotInCI_Set(t *testing.T) {
	t.Setenv("CI", "true")
	skip := modules.EvaluateSkipIf(&engine.SkipIf{NotInCI: true}, ".")
	if skip {
		t.Fatal("expected skip=false when CI is set")
	}
}

// CheckNoEnvVar tests

func TestCheckNoEnvVar_NotSet(t *testing.T) {
	os.Unsetenv("CONTRACTS_NOENV_TEST_XYZ")
	result := modules.CheckNoEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_NOENV_TEST_XYZ"})
	if !result.Pass {
		t.Fatalf("expected pass when var not set: %s", result.Reason)
	}
}

func TestCheckNoEnvVar_Set(t *testing.T) {
	t.Setenv("CONTRACTS_NOENV_TEST_XYZ", "hello")
	result := modules.CheckNoEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_NOENV_TEST_XYZ"})
	if result.Pass {
		t.Fatal("expected fail when var is set")
	}
}

func TestCheckNoEnvVar_Matches_Fail(t *testing.T) {
	t.Setenv("CONTRACTS_NOENV_TEST_XYZ", "production")
	result := modules.CheckNoEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_NOENV_TEST_XYZ", Matches: "prod.*"})
	if result.Pass {
		t.Fatal("expected fail: var is set and matches pattern")
	}
}

func TestCheckNoEnvVar_Matches_Pass(t *testing.T) {
	t.Setenv("CONTRACTS_NOENV_TEST_XYZ", "development")
	result := modules.CheckNoEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_NOENV_TEST_XYZ", Matches: "^prod"})
	if !result.Pass {
		t.Fatalf("expected pass: var set but does not match pattern: %s", result.Reason)
	}
}

func TestCheckNoEnvVar_InvalidRegex(t *testing.T) {
	t.Setenv("CONTRACTS_NOENV_TEST_XYZ", "value")
	result := modules.CheckNoEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_NOENV_TEST_XYZ", Matches: "["})
	if result.Pass {
		t.Fatal("expected fail for invalid regex")
	}
}

// CheckEnvVar additional tests

func TestCheckEnvVar_Equals_Match(t *testing.T) {
	t.Setenv("CONTRACTS_ENV_TEST_XYZ", "expected")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_ENV_TEST_XYZ", Equals: "expected"})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestCheckEnvVar_Equals_Mismatch(t *testing.T) {
	t.Setenv("CONTRACTS_ENV_TEST_XYZ", "wrong")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_ENV_TEST_XYZ", Equals: "expected"})
	if result.Pass {
		t.Fatal("expected fail: wrong value")
	}
}

func TestCheckEnvVar_Matches_Pass(t *testing.T) {
	t.Setenv("CONTRACTS_ENV_TEST_XYZ", "v1.2.3")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_ENV_TEST_XYZ", Matches: `^v\d+`})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestCheckEnvVar_Matches_Fail(t *testing.T) {
	t.Setenv("CONTRACTS_ENV_TEST_XYZ", "alpha")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_ENV_TEST_XYZ", Matches: `^v\d+`})
	if result.Pass {
		t.Fatal("expected fail: value does not match pattern")
	}
}

func TestCheckEnvVar_InvalidRegex(t *testing.T) {
	t.Setenv("CONTRACTS_ENV_TEST_XYZ", "value")
	result := modules.CheckEnvVar(&engine.EnvVarCheck{Name: "CONTRACTS_ENV_TEST_XYZ", Matches: "["})
	if result.Pass {
		t.Fatal("expected fail for invalid regex")
	}
}

// CheckPathExists additional tests

func TestCheckPathExists_NotExist(t *testing.T) {
	result := modules.CheckPathExists("/tmp/contracts-test-nonexistent-99999", engine.PathTypeFile)
	if result.Pass {
		t.Fatal("expected fail for nonexistent path")
	}
}

func TestCheckPathExists_IsDir_ExpectFile(t *testing.T) {
	dir := t.TempDir()
	result := modules.CheckPathExists(dir, engine.PathTypeFile)
	if result.Pass {
		t.Fatal("expected fail: dir exists but file type required")
	}
}

func TestCheckPathExists_IsFile_ExpectDir(t *testing.T) {
	f := filepath.Join(t.TempDir(), "x.txt")
	os.WriteFile(f, []byte("x"), 0644)
	result := modules.CheckPathExists(f, engine.PathTypeDirectory)
	if result.Pass {
		t.Fatal("expected fail: file exists but dir type required")
	}
}

func TestCheckPathExists_Directory(t *testing.T) {
	result := modules.CheckPathExists(t.TempDir(), engine.PathTypeDirectory)
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

// CheckPathNotExists additional tests

func TestCheckPathNotExists_Exists(t *testing.T) {
	f := filepath.Join(t.TempDir(), "x.txt")
	os.WriteFile(f, []byte("x"), 0644)
	result := modules.CheckPathNotExists(f)
	if result.Pass {
		t.Fatal("expected fail: path exists")
	}
}

// CheckNoRegexInFile additional tests

func TestCheckNoRegexInFile_Fail(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("// TODO: fix this"), 0644)
	result := modules.CheckNoRegexInFile(f, `TODO`)
	if result.Pass {
		t.Fatal("expected fail: pattern found in file")
	}
}

func TestCheckNoRegexInFile_ReadError(t *testing.T) {
	result := modules.CheckNoRegexInFile("/nonexistent-xyz/f.go", `TODO`)
	if result.Pass {
		t.Fatal("expected fail for unreadable file")
	}
}

func TestCheckNoRegexInFile_InvalidRegex(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("content"), 0644)
	result := modules.CheckNoRegexInFile(f, "[invalid")
	if result.Pass {
		t.Fatal("expected fail for invalid regex")
	}
}

// CheckRegexInFile additional tests

func TestCheckRegexInFile_ReadError(t *testing.T) {
	result := modules.CheckRegexInFile("/nonexistent-xyz/f.go", `TODO`)
	if result.Pass {
		t.Fatal("expected fail for unreadable file")
	}
}

func TestCheckRegexInFile_InvalidRegex(t *testing.T) {
	f := filepath.Join(t.TempDir(), "f.go")
	os.WriteFile(f, []byte("content"), 0644)
	result := modules.CheckRegexInFile(f, "[invalid")
	if result.Pass {
		t.Fatal("expected fail for invalid regex")
	}
}

// FindExemption additional tests

func TestFindExemption_ReadError(t *testing.T) {
	_, ok := modules.FindExemption("/nonexistent-xyz/f.go", "C-001")
	if ok {
		t.Fatal("expected not-found for unreadable file")
	}
}

// CheckKeyFile additional tests

func TestCheckKeyFile_ReadError(t *testing.T) {
	result := modules.CheckKeyFile("/nonexistent-xyz/c.yaml", "yaml", &engine.KeyCheck{Key: "name"})
	if result.Pass {
		t.Fatal("expected fail for unreadable file")
	}
}

func TestCheckKeyFile_BadYAML(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("key: [bad yaml"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "key"})
	if result.Pass {
		t.Fatal("expected fail for bad YAML")
	}
}

func TestCheckKeyFile_BadJSON(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.json")
	os.WriteFile(f, []byte("{bad json"), 0644)
	result := modules.CheckKeyFile(f, "json", &engine.KeyCheck{Key: "name"})
	if result.Pass {
		t.Fatal("expected fail for bad JSON")
	}
}

func TestCheckKeyFile_BadTOML(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.toml")
	os.WriteFile(f, []byte("[bad\n"), 0644)
	result := modules.CheckKeyFile(f, "toml", &engine.KeyCheck{Key: "name"})
	if result.Pass {
		t.Fatal("expected fail for bad TOML")
	}
}

func TestCheckKeyFile_UnknownFormat(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.xml")
	os.WriteFile(f, []byte("<xml/>"), 0644)
	result := modules.CheckKeyFile(f, "xml", &engine.KeyCheck{Key: "name"})
	if result.Pass {
		t.Fatal("expected fail for unknown format")
	}
}

func TestCheckKeyFile_Exists_True_Found(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("name: test\n"), 0644)
	yes := true
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "name", Exists: &yes})
	if !result.Pass {
		t.Fatalf("expected pass: key exists: %s", result.Reason)
	}
}

func TestCheckKeyFile_Exists_True_NotFound(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("other: test\n"), 0644)
	yes := true
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "name", Exists: &yes})
	if result.Pass {
		t.Fatal("expected fail: key required but missing")
	}
}

func TestCheckKeyFile_Exists_False_Found(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("secret: value\n"), 0644)
	no := false
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "secret", Exists: &no})
	if result.Pass {
		t.Fatal("expected fail: key exists but should not")
	}
}

func TestCheckKeyFile_Exists_False_NotFound(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("other: value\n"), 0644)
	no := false
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "secret", Exists: &no})
	if !result.Pass {
		t.Fatalf("expected pass: key absent as required: %s", result.Reason)
	}
}

func TestCheckKeyFile_Matches_Pass(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("version: v1.2.3\n"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "version", Matches: `^v\d+`})
	if !result.Pass {
		t.Fatalf("expected pass: %s", result.Reason)
	}
}

func TestCheckKeyFile_Matches_Fail(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("version: 1.2.3\n"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "version", Matches: `^v\d+`})
	if result.Pass {
		t.Fatal("expected fail: version does not match pattern")
	}
}

func TestCheckKeyFile_Matches_InvalidRegex(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("version: v1\n"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "version", Matches: "["})
	if result.Pass {
		t.Fatal("expected fail for invalid regex")
	}
}

func TestCheckKeyFile_NestedKey(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("server:\n  port: \"8080\"\n"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "server.port", Equals: "8080"})
	if !result.Pass {
		t.Fatalf("expected pass for nested key: %s", result.Reason)
	}
}

func TestCheckKeyFile_NestedKey_NotMap(t *testing.T) {
	f := filepath.Join(t.TempDir(), "c.yaml")
	os.WriteFile(f, []byte("server: string-not-map\n"), 0644)
	result := modules.CheckKeyFile(f, "yaml", &engine.KeyCheck{Key: "server.port", Equals: "8080"})
	if result.Pass {
		t.Fatal("expected fail: intermediate key is not a map")
	}
}

// RunScript additional tests

func TestRunScript_Timeout(t *testing.T) {
	result := modules.RunScript(&engine.ScriptCheck{
		Inline:  "sleep 10",
		Timeout: "1s",
	}, t.TempDir())
	if result.Pass {
		t.Fatal("expected fail: script timed out")
	}
	if !strings.Contains(result.Reason, "timed out") {
		t.Errorf("expected 'timed out' in reason, got: %s", result.Reason)
	}
}

func TestRunScript_Stderr(t *testing.T) {
	result := modules.RunScript(&engine.ScriptCheck{
		Inline: "echo error-output >&2; exit 1",
	}, t.TempDir())
	if result.Pass {
		t.Fatal("expected fail")
	}
	if !strings.Contains(result.Reason, "error-output") {
		t.Errorf("expected stderr in reason, got: %s", result.Reason)
	}
}
