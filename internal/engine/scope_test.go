package engine_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestResolveScope_Global(t *testing.T) {
	files, err := engine.ResolveScope(engine.Scope{Global: true}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0] != engine.GlobalSentinel {
		t.Fatalf("expected global sentinel, got %v", files)
	}
}

func TestResolveScope_Paths(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "foo.ts"), []byte("x"), 0644)
	os.WriteFile(filepath.Join(dir, "bar.go"), []byte("x"), 0644)

	files, err := engine.ResolveScope(engine.Scope{Paths: []string{"*.ts"}}, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d: %v", len(files), files)
	}
	if filepath.Base(files[0]) != "foo.ts" {
		t.Fatalf("unexpected file: %s", files[0])
	}
}

func TestResolveScope_Exclude(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "foo.ts"), []byte("x"), 0644)
	os.WriteFile(filepath.Join(dir, "foo.test.ts"), []byte("x"), 0644)

	scope := engine.Scope{
		Paths:   []string{"*.ts"},
		Exclude: []string{"*.test.ts"},
	}
	files, err := engine.ResolveScope(scope, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || filepath.Base(files[0]) != "foo.ts" {
		t.Fatalf("unexpected files: %v", files)
	}
}

// TestResolveScope_SkipsVendorDirs verifies that .git, node_modules, and vendor
// directories are skipped in the filesystem fallback (WalkDir path).
func TestResolveScope_SkipsVendorDirs(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "main.go"), []byte("x"), 0644)
	for _, skip := range []string{".git", "node_modules", "vendor"} {
		os.MkdirAll(filepath.Join(dir, skip), 0755)
		os.WriteFile(filepath.Join(dir, skip, "file.go"), []byte("x"), 0644)
	}

	files, err := engine.ResolveScope(engine.Scope{Paths: []string{"*.go"}}, dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range files {
		rel, _ := filepath.Rel(dir, f)
		parts := strings.SplitN(rel, string(filepath.Separator), 2)
		if len(parts) > 1 {
			top := parts[0]
			if top == ".git" || top == "node_modules" || top == "vendor" {
				t.Errorf("file inside skipped dir should not appear: %s", f)
			}
		}
	}
	if len(files) != 1 || filepath.Base(files[0]) != "main.go" {
		t.Errorf("expected only main.go, got %v", files)
	}
}

// TestResolveScope_GitFiles verifies that listFiles uses git ls-files when available.
func TestResolveScope_GitFiles(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	if err := exec.Command("git", "-C", dir, "init").Run(); err != nil {
		t.Skip("git init failed")
	}
	os.WriteFile(filepath.Join(dir, "main.go"), []byte("x"), 0644)
	// --others lists untracked files; no need to stage
	files, err := engine.ResolveScope(engine.Scope{Paths: []string{"*.go"}}, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Error("expected main.go from git ls-files --others in initialized repo")
	}
}

// TestResolveScope_BasenameSubdir verifies that bare glob patterns like "*.ts"
// match files in subdirectories via the basename fallback (rel path "src/foo.ts"
// does not match "*.ts" directly, but filepath.Base("src/foo.ts") == "foo.ts" does).
func TestResolveScope_BasenameSubdir(t *testing.T) {
	dir := t.TempDir()
	subdir := filepath.Join(dir, "src")
	os.MkdirAll(subdir, 0755)
	os.WriteFile(filepath.Join(subdir, "foo.ts"), []byte("x"), 0644)
	os.WriteFile(filepath.Join(subdir, "foo.test.ts"), []byte("x"), 0644)
	os.WriteFile(filepath.Join(subdir, "bar.go"), []byte("x"), 0644)

	scope := engine.Scope{
		Paths:   []string{"*.ts"},
		Exclude: []string{"*.test.ts"},
	}
	files, err := engine.ResolveScope(scope, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || filepath.Base(files[0]) != "foo.ts" {
		t.Fatalf("expected only foo.ts, got %v", files)
	}
}
