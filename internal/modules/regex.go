package modules

import (
	"fmt"
	"os"
	"regexp"
)

// CheckRegexInFile returns pass if pattern matches any content in the file.
// Patterns are compiled in multiline mode so ^ and $ match line boundaries.
func CheckRegexInFile(path, pattern string) Result {
	data, err := os.ReadFile(path)
	if err != nil {
		return Result{false, fmt.Sprintf("reading %s: %v", path, err)}
	}
	re, err := regexp.Compile("(?m)" + pattern)
	if err != nil {
		return Result{false, fmt.Sprintf("invalid regex %q: %v", pattern, err)}
	}
	if re.Match(data) {
		return Result{Pass: true}
	}
	return Result{false, fmt.Sprintf("pattern /%s/ not found in %s", pattern, path)}
}

// CheckNoRegexInFile returns pass if pattern does NOT match any content in the file.
// Patterns are compiled in multiline mode so ^ and $ match line boundaries.
func CheckNoRegexInFile(path, pattern string) Result {
	data, err := os.ReadFile(path)
	if err != nil {
		return Result{false, fmt.Sprintf("reading %s: %v", path, err)}
	}
	re, err := regexp.Compile("(?m)" + pattern)
	if err != nil {
		return Result{false, fmt.Sprintf("invalid regex %q: %v", pattern, err)}
	}
	if re.Match(data) {
		return Result{false, fmt.Sprintf("forbidden pattern /%s/ found in %s", pattern, path)}
	}
	return Result{Pass: true}
}
