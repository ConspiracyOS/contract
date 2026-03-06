package contracts

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDirAndRunAudit(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "C-1.yaml"), []byte(`
id: C-1
description: smoke
type: detective
scope: global
checks:
  - name: ok
    command:
      run: "true"
      exit_code: 0
    on_fail: fail
`), 0644); err != nil {
		t.Fatal(err)
	}

	contracts, err := LoadDir(dir)
	if err != nil {
		t.Fatalf("load dir: %v", err)
	}
	if len(contracts) != 1 {
		t.Fatalf("contracts = %d", len(contracts))
	}
	result := RunAudit(contracts, nil, dir)
	if result.Passed != 1 {
		t.Fatalf("passed = %d, want 1", result.Passed)
	}
}

func TestLoadDir_LegacyTriggerMapsToScheduleTag(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "C-2.yaml"), []byte(`
id: C-2
description: legacy trigger
type: detective
trigger: schedule
scope: global
checks:
  - name: ok
    command:
      run: "true"
      exit_code: 0
    on_fail: fail
`), 0644); err != nil {
		t.Fatal(err)
	}

	contracts, err := LoadDir(dir)
	if err != nil {
		t.Fatalf("load dir: %v", err)
	}
	if len(contracts) != 1 {
		t.Fatalf("contracts = %d", len(contracts))
	}
	if len(contracts[0].Tags) != 1 || contracts[0].Tags[0] != "schedule" {
		t.Fatalf("expected schedule tag from legacy trigger, got: %#v", contracts[0].Tags)
	}
}
