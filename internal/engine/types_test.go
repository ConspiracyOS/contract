package engine_test

import (
	"testing"
	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestContractDefaults(t *testing.T) {
	c := engine.Contract{ID: "C-001", Description: "test", Trigger: "commit"}
	if c.ID != "C-001" {
		t.Fatalf("expected C-001, got %s", c.ID)
	}
}
