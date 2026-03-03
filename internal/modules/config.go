package modules

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/BurntSushi/toml"
	"gopkg.in/yaml.v3"

	"github.com/ConspiracyOS/contracts/internal/types"
)

// CheckKeyFile checks a key in a YAML, JSON, or TOML file.
func CheckKeyFile(path, format string, c *types.KeyCheck) Result {
	data, err := os.ReadFile(path)
	if err != nil {
		return Result{false, fmt.Sprintf("reading %s: %v", path, err)}
	}

	var m map[string]interface{}
	switch format {
	case "yaml":
		if err := yaml.Unmarshal(data, &m); err != nil {
			return Result{false, fmt.Sprintf("parsing yaml %s: %v", path, err)}
		}
	case "json":
		if err := json.Unmarshal(data, &m); err != nil {
			return Result{false, fmt.Sprintf("parsing json %s: %v", path, err)}
		}
	case "toml":
		if _, err := toml.Decode(string(data), &m); err != nil {
			return Result{false, fmt.Sprintf("parsing toml %s: %v", path, err)}
		}
	default:
		return Result{false, fmt.Sprintf("unknown format: %s", format)}
	}

	val, found := deepGet(m, strings.Split(c.Key, "."))
	if c.Exists != nil {
		if *c.Exists && !found {
			return Result{false, fmt.Sprintf("key %q not found in %s", c.Key, path)}
		}
		if !*c.Exists && found {
			return Result{false, fmt.Sprintf("key %q should not exist in %s", c.Key, path)}
		}
		return Result{Pass: true}
	}

	if !found {
		return Result{false, fmt.Sprintf("key %q not found in %s", c.Key, path)}
	}

	strVal := fmt.Sprintf("%v", val)
	if c.Equals != "" && strVal != c.Equals {
		return Result{false, fmt.Sprintf("key %q = %q, expected %q", c.Key, strVal, c.Equals)}
	}
	if c.Matches != "" {
		re, err := regexp.Compile(c.Matches)
		if err != nil {
			return Result{false, fmt.Sprintf("invalid matches regex: %v", err)}
		}
		if !re.MatchString(strVal) {
			return Result{false, fmt.Sprintf("key %q = %q does not match /%s/", c.Key, strVal, c.Matches)}
		}
	}
	return Result{Pass: true}
}

func deepGet(m map[string]interface{}, keys []string) (interface{}, bool) {
	if len(keys) == 0 {
		return nil, false
	}
	val, ok := m[keys[0]]
	if !ok {
		return nil, false
	}
	if len(keys) == 1 {
		return val, true
	}
	sub, ok := val.(map[string]interface{})
	if !ok {
		return nil, false
	}
	return deepGet(sub, keys[1:])
}
