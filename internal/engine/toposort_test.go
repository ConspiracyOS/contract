package engine_test

import (
	"testing"
	"github.com/ConspiracyOS/contracts/internal/engine"
)

func TestTopoSort_NoDeps(t *testing.T) {
	contracts := []*engine.Contract{
		{ID: "A"}, {ID: "B"}, {ID: "C"},
	}
	sorted, err := engine.TopoSort(contracts)
	if err != nil {
		t.Fatal(err)
	}
	if len(sorted) != 3 {
		t.Fatalf("expected 3, got %d", len(sorted))
	}
}

func TestTopoSort_WithDeps(t *testing.T) {
	contracts := []*engine.Contract{
		{ID: "B", DependsOn: []string{"A"}},
		{ID: "A"},
		{ID: "C", DependsOn: []string{"B"}},
	}
	sorted, err := engine.TopoSort(contracts)
	if err != nil {
		t.Fatal(err)
	}
	pos := map[string]int{}
	for i, c := range sorted {
		pos[c.ID] = i
	}
	if pos["A"] >= pos["B"] {
		t.Error("A must come before B")
	}
	if pos["B"] >= pos["C"] {
		t.Error("B must come before C")
	}
}

func TestTopoSort_Cycle(t *testing.T) {
	contracts := []*engine.Contract{
		{ID: "A", DependsOn: []string{"B"}},
		{ID: "B", DependsOn: []string{"A"}},
	}
	_, err := engine.TopoSort(contracts)
	if err == nil {
		t.Fatal("expected error for cycle")
	}
}

func TestTopoSort_UnknownDep(t *testing.T) {
	// Unknown deps are ignored (contract may not be loaded)
	contracts := []*engine.Contract{
		{ID: "A", DependsOn: []string{"MISSING"}},
	}
	sorted, err := engine.TopoSort(contracts)
	if err != nil {
		t.Fatal(err)
	}
	if len(sorted) != 1 {
		t.Fatalf("expected 1, got %d", len(sorted))
	}
}
