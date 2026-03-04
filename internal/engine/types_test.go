package engine_test

import (
	"testing"
	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestContractDefaults(t *testing.T) {
	c := engine.Contract{ID: "C-001", Description: "test", Tags: []string{"pre-commit"}}
	if c.ID != "C-001" {
		t.Fatalf("expected C-001, got %s", c.ID)
	}
	if len(c.Tags) != 1 || c.Tags[0] != "pre-commit" {
		t.Fatalf("expected [pre-commit], got %v", c.Tags)
	}
}

func TestCheckBriefFields(t *testing.T) {
	c := engine.Check{
		Name:     "disk_free",
		Severity: "critical",
		Category: "performance",
		What:     "Disk usage above 85% on /",
		Verify:   "df / --output=pcent | tail -1",
		Affects:  []string{"/", "/srv/conos"},
	}
	if c.Severity != "critical" {
		t.Fatalf("expected critical, got %s", c.Severity)
	}
	if len(c.Affects) != 2 {
		t.Fatalf("expected 2 affects, got %d", len(c.Affects))
	}
}

func TestContractDependsOn(t *testing.T) {
	c := engine.Contract{DependsOn: []string{"CON-SYS-002"}}
	if len(c.DependsOn) != 1 {
		t.Fatalf("expected 1 dep, got %d", len(c.DependsOn))
	}
}

func TestCheckResultEvidence(t *testing.T) {
	cr := engine.CheckResult{Evidence: "Filesystem  Use%\n/dev/sda1    92%"}
	if cr.Evidence == "" {
		t.Fatal("expected non-empty evidence")
	}
}

func TestDefaultSeverity(t *testing.T) {
	cases := []struct {
		onFail engine.OnFail
		want   string
	}{
		{engine.OnFailHaltAgents, "critical"},
		{engine.OnFailFail, "high"},
		{engine.OnFailEscalate, "high"},
		{engine.OnFailWarn, "medium"},
		{engine.OnFailAlert, "medium"},
		{engine.OnFailRequireExemption, "low"},
		{"", "high"},
	}
	for _, tc := range cases {
		got := engine.DefaultSeverity(tc.onFail)
		if got != tc.want {
			t.Errorf("DefaultSeverity(%q) = %q, want %q", tc.onFail, got, tc.want)
		}
	}
}
