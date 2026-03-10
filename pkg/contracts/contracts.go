package contracts

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ConspiracyOS/contracts/internal/engine"
	"gopkg.in/yaml.v3"
)

type (
	Contract    = engine.Contract
	Check       = engine.Check
	CheckResult = engine.CheckResult
	AuditResult = engine.AuditResult
	OnFail      = engine.OnFail
)

const (
	OnFailFail             = engine.OnFailFail
	OnFailWarn             = engine.OnFailWarn
	OnFailRequireExemption = engine.OnFailRequireExemption
	OnFailEscalate         = engine.OnFailEscalate
	OnFailHaltAgents       = engine.OnFailHaltAgents
	OnFailAlert            = engine.OnFailAlert
	OnFailHalt             = engine.OnFailHalt
)

// LoadDir loads all YAML contracts from a directory.
func LoadDir(dir string) ([]*Contract, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading contracts dir: %w", err)
	}
	var out []*Contract
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yaml") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", e.Name(), err)
		}
		c, err := engine.ParseContract(data)
		if err != nil {
			return nil, fmt.Errorf("parsing %s: %w", e.Name(), err)
		}
		applyLegacyTags(data, c)
		out = append(out, c)
	}
	return out, nil
}

// RunAudit evaluates loaded contracts for a given project/contracts root.
func RunAudit(contracts []*Contract, tags []string, root string) AuditResult {
	return engine.RunAudit(contracts, tags, root)
}

type legacyContractMeta struct {
	Trigger   string `yaml:"trigger"`
	Frequency string `yaml:"frequency"`
}

func applyLegacyTags(data []byte, c *Contract) {
	if c == nil || len(c.Tags) > 0 {
		return
	}
	var meta legacyContractMeta
	if err := yaml.Unmarshal(data, &meta); err != nil {
		return
	}
	if meta.Trigger == "schedule" || meta.Frequency != "" {
		c.Tags = []string{"schedule"}
	}
}
