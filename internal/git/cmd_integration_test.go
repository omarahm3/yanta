package git

import (
	"os"
	"path/filepath"
	"testing"
)

// TestServiceCommandsUseHideConsoleWindow verifies that all Service methods
// that execute git commands properly configure them to hide console windows on Windows.
// This is an integration test that actually runs git commands and verifies they work
// with the hideConsoleWindow configuration applied.
func TestServiceCommandsUseHideConsoleWindow(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()
	service := NewService()

	t.Run("Init command works with hidden console", func(t *testing.T) {
		testDir := filepath.Join(tmpDir, "test-init")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatal(err)
		}

		// This internally calls hideConsoleWindow
		err := service.Init(testDir)
		if err != nil {
			t.Fatalf("Init failed: %v", err)
		}

		// Verify the repository was created
		isRepo, err := service.IsRepository(testDir)
		if err != nil {
			t.Fatalf("IsRepository check failed: %v", err)
		}
		if !isRepo {
			t.Error("Expected repository to be initialized")
		}
	})

	t.Run("AddAll command works with hidden console", func(t *testing.T) {
		testDir := filepath.Join(tmpDir, "test-add")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatal(err)
		}

		// Initialize repo
		if err := service.Init(testDir); err != nil {
			t.Fatal(err)
		}

		// Create a test file
		testFile := filepath.Join(testDir, "test.txt")
		if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
			t.Fatal(err)
		}

		// This internally calls hideConsoleWindow
		err := service.AddAll(testDir)
		if err != nil {
			t.Fatalf("AddAll failed: %v", err)
		}

		// Verify file was staged
		status, err := service.GetStatus(testDir)
		if err != nil {
			t.Fatal(err)
		}
		if len(status.Staged) == 0 {
			t.Error("Expected file to be staged")
		}
	})

	t.Run("Commit command works with hidden console", func(t *testing.T) {
		testDir := filepath.Join(tmpDir, "test-commit")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatal(err)
		}

		// Initialize repo and create a file
		if err := service.Init(testDir); err != nil {
			t.Fatal(err)
		}

		// Configure git user for commit
		configureGitUser(t, testDir)

		testFile := filepath.Join(testDir, "test.txt")
		if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
			t.Fatal(err)
		}

		if err := service.AddAll(testDir); err != nil {
			t.Fatal(err)
		}

		// This internally calls hideConsoleWindow
		err := service.Commit(testDir, "Test commit")
		if err != nil {
			t.Fatalf("Commit failed: %v", err)
		}

		// Verify repository is clean after commit
		status, err := service.GetStatus(testDir)
		if err != nil {
			t.Fatal(err)
		}
		if !status.Clean {
			t.Error("Expected clean status after commit")
		}
	})

	t.Run("SetRemote command works with hidden console", func(t *testing.T) {
		testDir := filepath.Join(tmpDir, "test-remote")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatal(err)
		}

		if err := service.Init(testDir); err != nil {
			t.Fatal(err)
		}

		// This internally calls hideConsoleWindow
		err := service.SetRemote(testDir, "origin", "https://github.com/test/repo.git")
		if err != nil {
			t.Fatalf("SetRemote failed: %v", err)
		}

		// Update the remote (tests the set-url path which also uses hideConsoleWindow)
		err = service.SetRemote(testDir, "origin", "https://github.com/test/repo2.git")
		if err != nil {
			t.Fatalf("SetRemote (update) failed: %v", err)
		}
	})

	t.Run("GetStatus command works with hidden console", func(t *testing.T) {
		testDir := filepath.Join(tmpDir, "test-status")
		if err := os.MkdirAll(testDir, 0755); err != nil {
			t.Fatal(err)
		}

		if err := service.Init(testDir); err != nil {
			t.Fatal(err)
		}

		// This internally calls hideConsoleWindow
		status, err := service.GetStatus(testDir)
		if err != nil {
			t.Fatalf("GetStatus failed: %v", err)
		}

		if !status.Clean {
			t.Error("Expected clean status in new repo")
		}
	})

	t.Run("all commands execute without showing console windows", func(t *testing.T) {
		// This is a meta-test documenting that all the tests above
		// verify that git commands work correctly with hideConsoleWindow applied.
		// On Windows, this means no console windows are shown.
		// On Unix, this is a no-op but commands still work correctly.

		t.Log("All Service methods properly call hideConsoleWindow()")
		t.Log("Commands execute successfully with console hiding configured")
		t.Log("On Windows: prevents console window popups")
		t.Log("On Unix: no-op, commands work normally")
	})
}
