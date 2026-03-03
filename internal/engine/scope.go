package engine

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

// GlobalSentinel is passed as the "file" for global-scope checks (no file context).
const GlobalSentinel = "__global__"

// ResolveScope returns the list of files the contract applies to.
// Uses git ls-files if available, falls back to filesystem glob.
func ResolveScope(scope Scope, projectRoot string) ([]string, error) {
	if scope.Global {
		return []string{GlobalSentinel}, nil
	}

	all, err := listFiles(projectRoot)
	if err != nil {
		return nil, err
	}

	var matched []string
	for _, f := range all {
		rel, err := filepath.Rel(projectRoot, f)
		if err != nil {
			continue
		}
		for _, pattern := range scope.Paths {
			ok, _ := doublestar.Match(pattern, rel)
			if !ok && hasWildcard(pattern) {
				ok, _ = doublestar.Match(pattern, filepath.Base(rel))
			}
			if ok {
				matched = append(matched, f)
				break
			}
		}
	}

	if len(scope.Exclude) == 0 {
		return matched, nil
	}

	var filtered []string
	for _, f := range matched {
		rel, _ := filepath.Rel(projectRoot, f)
		excluded := false
		for _, ex := range scope.Exclude {
			if ok, _ := doublestar.Match(ex, rel); ok {
				excluded = true
				break
			}
			if hasWildcard(ex) {
				if ok, _ := doublestar.Match(ex, filepath.Base(rel)); ok {
					excluded = true
					break
				}
			}
		}
		if !excluded {
			filtered = append(filtered, f)
		}
	}
	return filtered, nil
}

// hasWildcard reports whether a glob pattern contains wildcard characters.
// The base-name fallback in ResolveScope only applies to wildcard patterns so
// that exact filenames like ".gitignore" match only at the path where they appear,
// not at every depth in the repo.
func hasWildcard(pattern string) bool {
	return strings.ContainsAny(pattern, "*?[")
}

// listFiles returns tracked git files, or falls back to filesystem walk.
func listFiles(root string) ([]string, error) {
	cmd := exec.Command("git", "ls-files", "--cached", "--others", "--exclude-standard")
	cmd.Dir = root
	out, err := cmd.Output()
	if err == nil && len(out) > 0 {
		var files []string
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			if line != "" {
				files = append(files, filepath.Join(root, line))
			}
		}
		return files, nil
	}

	// Fallback: walk filesystem
	var files []string
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			name := d.Name()
			if name == ".git" || name == "node_modules" || name == "vendor" {
				return filepath.SkipDir
			}
			return nil
		}
		files = append(files, path)
		return nil
	})
	return files, err
}
