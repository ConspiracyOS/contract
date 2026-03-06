package project

import (
	"fmt"
	"strconv"
	"strings"
)

// CheckMinVersion returns an error if installed is less than required.
// Both versions are dot-separated integers, e.g. "0.2" or "1.0.0".
// Empty required is always satisfied.
func CheckMinVersion(required, installed string) error {
	if required == "" {
		return nil
	}
	req := parseVersion(required)
	ins := parseVersion(installed)
	for i := 0; i < max(len(req), len(ins)); i++ {
		r, in := 0, 0
		if i < len(req) {
			r = req[i]
		}
		if i < len(ins) {
			in = ins[i]
		}
		if in > r {
			return nil
		}
		if in < r {
			return fmt.Errorf("this project requires contracts >= %s (you have %s)\nInstall: go install github.com/ConspiracyOS/contracts/cmd/contracts@latest", required, installed)
		}
	}
	return nil
}

func parseVersion(v string) []int {
	var parts []int
	for _, s := range strings.Split(v, ".") {
		n, err := strconv.Atoi(s)
		if err != nil {
			n = 0
		}
		parts = append(parts, n)
	}
	return parts
}
