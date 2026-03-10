package engine

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// rawContract mirrors the YAML structure before custom unmarshalling of Tags and Scope.
type rawContract struct {
	ID          string       `yaml:"id"`
	Description string       `yaml:"description"`
	Type        ContractType `yaml:"type"`
	Trigger     string       `yaml:"trigger,omitempty"`
	Tags        yaml.Node    `yaml:"tags"` // scalar or sequence
	Scope       yaml.Node    `yaml:"scope"`
	SkipIf      *SkipIf      `yaml:"skip_if"`
	Checks      []Check      `yaml:"checks"`
}

func ParseContract(data []byte) (*Contract, error) {
	var raw rawContract
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("yaml parse error: %w", err)
	}
	if raw.ID == "" {
		return nil, fmt.Errorf("contract missing required field: id")
	}
	if raw.Description == "" {
		return nil, fmt.Errorf("contract %s missing required field: description", raw.ID)
	}
	if len(raw.Checks) == 0 {
		return nil, fmt.Errorf("contract %s: must have at least one check", raw.ID)
	}

	tags, err := parseTags(&raw.Tags)
	if err != nil {
		return nil, fmt.Errorf("contract %s: invalid tags: %w", raw.ID, err)
	}

	scope, err := parseScope(&raw.Scope)
	if err != nil {
		return nil, fmt.Errorf("contract %s: invalid scope: %w", raw.ID, err)
	}

	return &Contract{
		ID:          raw.ID,
		Description: raw.Description,
		Type:        raw.Type,
		Trigger:     raw.Trigger,
		Tags:        tags,
		Scope:       scope,
		SkipIf:      raw.SkipIf,
		Checks:      raw.Checks,
	}, nil
}

// parseTags accepts a YAML scalar ("security") or sequence (["security", "schedule"]).
func parseTags(node *yaml.Node) ([]string, error) {
	if node == nil || node.Tag == "" {
		return nil, nil
	}
	if node.Kind == yaml.ScalarNode {
		if node.Value == "" {
			return nil, nil
		}
		return []string{node.Value}, nil
	}
	if node.Kind == yaml.SequenceNode {
		var tags []string
		if err := node.Decode(&tags); err != nil {
			return nil, err
		}
		return tags, nil
	}
	return nil, fmt.Errorf("tags must be a string or list of strings")
}

func parseScope(node *yaml.Node) (Scope, error) {
	if node == nil || node.Tag == "" {
		// Default: global scope
		return Scope{Global: true}, nil
	}

	// "global" string
	if node.Kind == yaml.ScalarNode && node.Value == "global" {
		return Scope{Global: true}, nil
	}

	// Mapping: {paths: [...], exclude: [...]}
	if node.Kind == yaml.MappingNode {
		var m struct {
			Paths   []string `yaml:"paths"`
			Exclude []string `yaml:"exclude"`
		}
		if err := node.Decode(&m); err != nil {
			return Scope{}, err
		}
		if len(m.Paths) == 0 {
			m.Paths = []string{"**/*"}
		}
		return Scope{Paths: m.Paths, Exclude: m.Exclude}, nil
	}

	return Scope{}, fmt.Errorf("scope must be \"global\" or a mapping with paths/exclude")
}

func ParseContractFile(path string) (*Contract, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	c, err := ParseContract(data)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return c, nil
}
