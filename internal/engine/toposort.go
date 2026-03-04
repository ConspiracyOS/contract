package engine

import "fmt"

// TopoSort returns contracts in dependency order (Kahn's algorithm).
// Contracts with unknown depends_on IDs are treated as having no dependency.
// Returns error on cycle.
func TopoSort(contracts []*Contract) ([]*Contract, error) {
	index := make(map[string]*Contract, len(contracts))
	for _, c := range contracts {
		index[c.ID] = c
	}

	// Build in-degree map (only count deps that exist in the set)
	inDegree := make(map[string]int, len(contracts))
	for _, c := range contracts {
		if _, ok := inDegree[c.ID]; !ok {
			inDegree[c.ID] = 0
		}
		for _, dep := range c.DependsOn {
			if _, exists := index[dep]; exists {
				inDegree[c.ID]++
			}
		}
	}

	// Build reverse edges
	dependents := make(map[string][]string)
	for _, c := range contracts {
		for _, dep := range c.DependsOn {
			if _, exists := index[dep]; exists {
				dependents[dep] = append(dependents[dep], c.ID)
			}
		}
	}

	// Collect zero in-degree nodes
	var queue []string
	for _, c := range contracts {
		if inDegree[c.ID] == 0 {
			queue = append(queue, c.ID)
		}
	}

	var sorted []*Contract
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		sorted = append(sorted, index[id])
		for _, dep := range dependents[id] {
			inDegree[dep]--
			if inDegree[dep] == 0 {
				queue = append(queue, dep)
			}
		}
	}

	if len(sorted) != len(contracts) {
		return nil, fmt.Errorf("depends_on cycle detected in contracts")
	}
	return sorted, nil
}
