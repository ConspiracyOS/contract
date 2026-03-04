package project_test

import (
	"testing"

	"github.com/ConspiracyOS/contracts/internal/project"
)

func TestCheckMinVersion(t *testing.T) {
	cases := []struct {
		required  string
		installed string
		wantErr   bool
	}{
		{"", "0.1.0", false},       // no requirement
		{"0.1", "0.1.0", false},    // exact match
		{"0.2", "0.2.0", false},    // exact match with patch
		{"0.1", "0.2.0", false},    // installed newer
		{"0.2", "0.1.0", true},     // installed older
		{"1.0", "0.9.0", true},     // major too old
		{"0.2", "1.0.0", false},    // installed much newer
		{"0.2.1", "0.2.0", true},   // patch too old
		{"0.2.0", "0.2.1", false},  // patch newer
	}
	for _, tc := range cases {
		err := project.CheckMinVersion(tc.required, tc.installed)
		if (err != nil) != tc.wantErr {
			t.Errorf("CheckMinVersion(%q, %q) err=%v, wantErr=%v", tc.required, tc.installed, err, tc.wantErr)
		}
	}
}
