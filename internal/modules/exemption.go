package modules

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"

	"github.com/ConspiracyOS/contracts/internal/types"
)

var exemptionRE = func(id string) *regexp.Regexp {
	return regexp.MustCompile(fmt.Sprintf(`(?://|#)\s*@contract:%s:exempt:(.+)`, regexp.QuoteMeta(id)))
}

// FindExemption scans a file for an inline exemption comment.
// Matches: // @contract:C-001:exempt:reason text
//
//	#  @contract:C-001:exempt:reason text
func FindExemption(filePath, contractID string) (reason string, found bool) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", false
	}
	m := exemptionRE(contractID).FindSubmatch(data)
	if m == nil {
		return "", false
	}
	r := string(m[1])
	if r == "" {
		return "", false
	}
	return r, true
}

// EvaluateSkipIf returns true if the check should be skipped.
func EvaluateSkipIf(s *types.SkipIf, projectRoot string) bool {
	if s == nil {
		return false
	}
	if s.EnvVarUnset != "" {
		if _, ok := os.LookupEnv(s.EnvVarUnset); !ok {
			return true
		}
	}
	if s.PathNotExists != "" {
		path := s.PathNotExists
		if !filepath.IsAbs(path) {
			path = filepath.Join(projectRoot, path)
		}
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			return true
		}
	}
	if s.NotInCI {
		if _, ok := os.LookupEnv("CI"); !ok {
			return true
		}
	}
	if s.CommandNotAvailable != "" {
		if _, err := exec.LookPath(s.CommandNotAvailable); err != nil {
			return true
		}
	}
	return false
}
