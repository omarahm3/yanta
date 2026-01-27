package testenv

import (
	"os"
	"runtime"
	"testing"
)

// SetTestHome sets the home directory for testing in a cross-platform way.
// On Windows, os.UserHomeDir() uses USERPROFILE, on Unix it uses HOME.
// Returns a cleanup function that restores the original values.
//
// Usage:
//
//	func TestMyFunc(t *testing.T) {
//	    tempDir := t.TempDir()
//	    cleanup := testenv.SetTestHome(t, tempDir)
//	    defer cleanup()
//	    // ... test code
//	}
func SetTestHome(t *testing.T, dir string) func() {
	t.Helper()
	var oldHome, oldUserProfile string

	if runtime.GOOS == "windows" {
		oldUserProfile = os.Getenv("USERPROFILE")
		os.Setenv("USERPROFILE", dir)
	}
	// Always set HOME for compatibility
	oldHome = os.Getenv("HOME")
	os.Setenv("HOME", dir)

	return func() {
		os.Setenv("HOME", oldHome)
		if runtime.GOOS == "windows" {
			os.Setenv("USERPROFILE", oldUserProfile)
		}
	}
}
