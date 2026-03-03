package builtins_test

import (
	"testing"

	"github.com/ConspiracyOS/contracts/internal/builtins"
)

func TestLoad_Proc(t *testing.T) {
	contracts, err := builtins.Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(contracts) == 0 {
		t.Fatal("expected at least one proc contract")
	}
	for _, c := range contracts {
		if !c.Builtin {
			t.Fatalf("expected builtin=true for %s", c.ID)
		}
	}
}

func TestLoad_GoStack(t *testing.T) {
	contracts, err := builtins.Load([]string{"go"})
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, c := range contracts {
		if c.ID == "C-GO-001" || c.ID == "C-GO-002" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected at least one go stack contract")
	}
}

func TestLoad_UnknownStack(t *testing.T) {
	// Unknown stack should not error — just return proc contracts
	contracts, err := builtins.Load([]string{"notastack"})
	if err != nil {
		t.Fatal(err)
	}
	if len(contracts) == 0 {
		t.Fatal("expected proc contracts even with unknown stack")
	}
}
