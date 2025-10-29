package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
	"yanta/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestConfig sets up a test config and returns a cleanup function
func setupTestConfig(t *testing.T, tempDir string, gitCfg config.GitSyncConfig) func() {
	t.Helper()

	// Save current config
	originalDataDir := config.GetDataDirectory()
	originalGitCfg := config.GetGitSyncConfig()

	// Setup test config
	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(tempDir))
	require.NoError(t, config.SetGitSyncConfig(gitCfg))

	// Return cleanup function
	return func() {
		config.ResetForTesting()
		require.NoError(t, config.Init())
		require.NoError(t, config.SetDataDirectory(originalDataDir))
		require.NoError(t, config.SetGitSyncConfig(originalGitCfg))
	}
}

func TestSyncManager_NotifyChange(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: true,
		AutoPush:   false,
	})
	defer cleanup()

	sm := NewSyncManager()
	defer sm.Shutdown()

	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	t.Run("single change triggers commit", func(t *testing.T) {
		sm.NotifyChange("test change")

		time.Sleep(3 * time.Second)

		log, err := getGitLog(tempDir)
		require.NoError(t, err)
		assert.Contains(t, log, "auto: test change")
	})
}

func TestSyncManager_DebounceBatching(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: true,
		AutoPush:   false,
	})
	defer cleanup()

	sm := NewSyncManager()
	defer sm.Shutdown()

	for i := 0; i < 5; i++ {
		testFile := filepath.Join(tempDir, "test"+string(rune('0'+i))+".txt")
		require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))
		sm.NotifyChange("change " + string(rune('0'+i)))
		time.Sleep(100 * time.Millisecond)
	}

	time.Sleep(3 * time.Second)

	log, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.Contains(t, log, "auto: 5 changes")
}

func TestSyncManager_DisabledSync(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    false,
		AutoCommit: false,
	})
	defer cleanup()

	sm := NewSyncManager()
	defer sm.Shutdown()

	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm.NotifyChange("test change")
	time.Sleep(3 * time.Second)

	status, err := getGitStatus(tempDir)
	require.NoError(t, err)
	assert.Contains(t, status, "test.txt")
}

func TestSyncManager_NotGitRepo(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: true,
	})
	defer cleanup()

	sm := NewSyncManager()
	defer sm.Shutdown()

	sm.NotifyChange("test change")
	time.Sleep(3 * time.Second)
}

func TestSyncManager_AutoPush(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: true,
		AutoPush:   true,
	})
	defer cleanup()

	gitService := NewService()
	require.NoError(t, gitService.SetRemote(tempDir, "origin", "https://github.com/test/repo.git"))

	sm := NewSyncManager()
	defer sm.Shutdown()

	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm.NotifyChange("test change")
	time.Sleep(3 * time.Second)
}

func TestSyncManager_NothingToCommit(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: true,
	})
	defer cleanup()

	sm := NewSyncManager()
	defer sm.Shutdown()

	sm.NotifyChange("no actual changes")
	time.Sleep(3 * time.Second)
}

func TestSyncManager_Shutdown(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{})
	defer cleanup()

	sm := NewSyncManager()
	sm.Shutdown()

	sm.NotifyChange("after shutdown")
	time.Sleep(500 * time.Millisecond)
}

func setupGitRepo(t *testing.T, repoPath string) {
	t.Helper()

	gitService := NewService()
	require.NoError(t, gitService.Init(repoPath))

	cmd := exec.Command("git", "config", "user.email", "test@example.com")
	cmd.Dir = repoPath
	require.NoError(t, cmd.Run())

	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = repoPath
	require.NoError(t, cmd.Run())

	initialFile := filepath.Join(repoPath, "README.md")
	require.NoError(t, os.WriteFile(initialFile, []byte("# Test Repo"), 0644))

	require.NoError(t, gitService.AddAll(repoPath))
	require.NoError(t, gitService.Commit(repoPath, "initial commit"))
}
