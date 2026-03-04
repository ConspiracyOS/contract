package modules

import (
	"errors"
	"fmt"
	"os"

	"github.com/ConspiracyOS/contracts/internal/types"
)

// CheckPathExists returns pass if the path exists, optionally asserting file or directory type.
func CheckPathExists(path string, fileType types.PathType) Result {
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Result{false, fmt.Sprintf("path does not exist: %s", path), ""}
		}
		return Result{false, fmt.Sprintf("stat %s: %v", path, err), ""}
	}
	switch fileType {
	case types.PathTypeFile:
		if info.IsDir() {
			return Result{false, fmt.Sprintf("%s exists but is a directory", path), ""}
		}
	case types.PathTypeDirectory:
		if !info.IsDir() {
			return Result{false, fmt.Sprintf("%s exists but is a file", path), ""}
		}
	}
	return Result{Pass: true}
}

// CheckPathNotExists returns pass if the path does not exist.
// Returns fail if the path exists or if the stat call fails for an unexpected reason.
func CheckPathNotExists(path string) Result {
	_, err := os.Stat(path)
	if err == nil {
		return Result{false, fmt.Sprintf("path should not exist: %s", path), ""}
	}
	if errors.Is(err, os.ErrNotExist) {
		return Result{Pass: true}
	}
	return Result{false, fmt.Sprintf("stat %s: %v", path, err), ""}
}
