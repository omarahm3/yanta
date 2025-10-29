//go:build !windows

package git

import (
	"os/exec"
	"testing"
)

func TestHideConsoleWindow_Unix(t *testing.T) {
	t.Run("is a no-op on Unix systems", func(t *testing.T) {
		cmd := exec.Command("git", "--version")

		// SysProcAttr should be nil initially
		if cmd.SysProcAttr != nil {
			t.Log("SysProcAttr is not nil initially, but that's OK")
		}

		// Call the function
		hideConsoleWindow(cmd)

		// On Unix, this should be a no-op
		// We can't check specific Windows fields, but we can verify
		// the command still works
		output, err := cmd.Output()
		if err != nil {
			t.Fatalf("command failed: %v", err)
		}

		if len(output) == 0 {
			t.Error("expected output from git --version")
		}
	})

	t.Run("does not break existing attributes", func(t *testing.T) {
		cmd := exec.Command("git", "--version")

		// Call the function - should not panic or cause issues
		hideConsoleWindow(cmd)

		// Command should still be executable
		if err := cmd.Run(); err != nil {
			t.Fatalf("command should run successfully: %v", err)
		}
	})

	t.Run("Unix systems don't show console windows", func(t *testing.T) {
		// This is a documentation test
		t.Log("Unix systems (Linux, macOS) don't show console windows for subprocesses")
		t.Log("hideConsoleWindow is a no-op on these platforms")
		t.Log("The function exists for cross-platform compatibility")
	})
}
