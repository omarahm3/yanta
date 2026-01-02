package git

import (
	"database/sql"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
	"yanta/internal/config"
	"yanta/internal/db"

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

// setupTestDB creates a test database with migrations
func setupTestDB(t *testing.T, tempDir string) *sql.DB {
	t.Helper()

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := db.OpenDB(dbPath)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(database))

	t.Cleanup(func() {
		db.CloseDB(database)
	})

	return database
}

func TestSyncManager_NotifyChange_AccumulatesReasons(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		AutoPush:       false,
		CommitInterval: 10, // 10 minutes - won't trigger during test
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	defer sm.Shutdown()

	// NotifyChange should accumulate reasons
	sm.NotifyChange("change 1")
	sm.NotifyChange("change 2")
	sm.NotifyChange("change 3")

	assert.Equal(t, 3, sm.GetPendingChangesCount())
	assert.True(t, sm.HasPendingChanges())
}

func TestSyncManager_DisabledSync_IgnoresChanges(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    false,
		AutoCommit: false,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	defer sm.Shutdown()

	sm.NotifyChange("test change")

	assert.Equal(t, 0, sm.GetPendingChangesCount())
	assert.False(t, sm.HasPendingChanges())
}

func TestSyncManager_AutoCommitDisabled_IgnoresChanges(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:    true,
		AutoCommit: false, // Auto-commit disabled
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	defer sm.Shutdown()

	sm.NotifyChange("test change")

	assert.Equal(t, 0, sm.GetPendingChangesCount())
	assert.False(t, sm.HasPendingChanges())
}

func TestSyncManager_Shutdown_DoesNotFlush(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10, // 10 minutes
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create a file to change
	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm := NewSyncManager(database)
	sm.Start()

	sm.NotifyChange("test change")
	assert.True(t, sm.HasPendingChanges())

	// Shutdown should NOT flush pending changes
	sm.Shutdown()

	// Verify no commit was made
	log, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.NotContains(t, log, "auto: test change")
}

func TestSyncManager_ShutdownAfterClose_IsIdempotent(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	sm.Shutdown()
	sm.Shutdown() // Should not panic

	// NotifyChange after shutdown should be ignored
	sm.NotifyChange("after shutdown")
	assert.Equal(t, 0, sm.GetPendingChangesCount())
}

func TestSyncManager_ManualOnlyMode(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 0, // 0 means manual only
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	sm.NotifyChange("test change")

	// With CommitInterval=0, changes should still be recorded
	assert.True(t, sm.HasPendingChanges())

	// But checkAndSync should not commit (manual only mode)
	sm.checkAndSync()
	// The pending changes remain
	assert.True(t, sm.HasPendingChanges())
}

func TestSyncManager_PersistsLastCommitTime(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create a file to change
	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	// First sync manager
	sm1 := NewSyncManager(database)
	sm1.Start()

	sm1.NotifyChange("test change")

	// Manually trigger sync by calling performSync
	sm1.mu.Lock()
	reasons := sm1.reasons
	sm1.mu.Unlock()
	sm1.performSync(reasons)

	sm1.Shutdown()

	// Second sync manager should load the persisted time
	sm2 := NewSyncManager(database)
	defer sm2.Shutdown()

	// The lastCommitTime should be loaded from DB
	sm2.mu.Lock()
	lastCommitTime := sm2.lastCommitTime
	sm2.mu.Unlock()

	assert.False(t, lastCommitTime.IsZero(), "lastCommitTime should be loaded from DB")
}

func TestSyncManager_BuildCommitMessage(t *testing.T) {
	sm := &SyncManager{}

	t.Run("single reason", func(t *testing.T) {
		msg := sm.buildCommitMessage([]string{"indexed doc.json"})
		assert.Equal(t, "auto: indexed doc.json", msg)
	})

	t.Run("multiple reasons", func(t *testing.T) {
		msg := sm.buildCommitMessage([]string{"change 1", "change 2", "change 3"})
		assert.Equal(t, "auto: 3 changes", msg)
	})
}

func TestSyncManager_NotGitRepo_SkipsSync(t *testing.T) {
	tempDir := t.TempDir()
	// Don't initialize git repo

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)
	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	sm.NotifyChange("test change")
	assert.True(t, sm.HasPendingChanges())

	// performSync should handle non-git repo gracefully
	sm.mu.Lock()
	reasons := sm.reasons
	sm.mu.Unlock()
	sm.performSync(reasons)

	// Pending changes should still be there (sync didn't complete)
	// Actually, performSync won't clear them if it's not a git repo
}

func TestSyncManager_ForceSync(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 60, // 60 minutes - won't trigger naturally
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create a file to change
	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	sm.NotifyChange("force sync test")
	assert.True(t, sm.HasPendingChanges())
	assert.Equal(t, 1, sm.GetPendingChangesCount())

	// ForceSync should commit immediately regardless of interval
	sm.ForceSync()

	// Pending changes should be cleared
	assert.False(t, sm.HasPendingChanges())
	assert.Equal(t, 0, sm.GetPendingChangesCount())

	// Verify commit was made
	log, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.Contains(t, log, "auto: force sync test")
}

func TestSyncManager_CheckAndSync_RespectsInterval(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10, // 10 minutes
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create a file to change
	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	// Set lastCommitTime to now so interval hasn't passed
	sm.mu.Lock()
	sm.lastCommitTime = time.Now()
	sm.mu.Unlock()

	sm.NotifyChange("interval test")
	assert.True(t, sm.HasPendingChanges())

	// checkAndSync should NOT commit because interval hasn't passed
	sm.checkAndSync()

	// Pending changes should still be there
	assert.True(t, sm.HasPendingChanges())
	assert.Equal(t, 1, sm.GetPendingChangesCount())
}

func TestSyncManager_CheckAndSync_CommitsAfterInterval(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 1, // 1 minute
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create a file to change
	testFile := filepath.Join(tempDir, "test.txt")
	require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	// Set lastCommitTime to 2 minutes ago so interval has passed
	sm.mu.Lock()
	sm.lastCommitTime = time.Now().Add(-2 * time.Minute)
	sm.mu.Unlock()

	sm.NotifyChange("after interval test")
	assert.True(t, sm.HasPendingChanges())

	// checkAndSync SHOULD commit because interval has passed
	sm.checkAndSync()

	// Pending changes should be cleared
	assert.False(t, sm.HasPendingChanges())
	assert.Equal(t, 0, sm.GetPendingChangesCount())

	// Verify commit was made
	log, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.Contains(t, log, "auto: after interval test")
}

func TestSyncManager_NoPendingChanges_NoCommit(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 1,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	// Set lastCommitTime to 2 minutes ago
	sm.mu.Lock()
	sm.lastCommitTime = time.Now().Add(-2 * time.Minute)
	sm.mu.Unlock()

	// Don't call NotifyChange - no pending changes
	assert.False(t, sm.HasPendingChanges())

	// Get initial git log
	initialLog, err := getGitLog(tempDir)
	require.NoError(t, err)

	// checkAndSync should do nothing when no pending changes
	sm.checkAndSync()

	// Git log should be unchanged
	finalLog, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.Equal(t, initialLog, finalLog)
}

func TestSyncManager_CleanStatus_ClearsPending(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	// NotifyChange but don't actually create any file changes
	sm.NotifyChange("phantom change")
	assert.True(t, sm.HasPendingChanges())

	// ForceSync - git status will be clean, so pending should be cleared
	sm.ForceSync()

	// Pending should be cleared even though nothing was committed
	assert.False(t, sm.HasPendingChanges())
}

func TestSyncManager_MultipleChanges_BatchedCommit(t *testing.T) {
	skipIfNoGit(t)

	tempDir := t.TempDir()
	setupGitRepo(t, tempDir)

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Create multiple files
	for i := 0; i < 5; i++ {
		testFile := filepath.Join(tempDir, "test"+string(rune('0'+i))+".txt")
		require.NoError(t, os.WriteFile(testFile, []byte("content"), 0644))
	}

	sm := NewSyncManager(database)
	sm.Start()
	defer sm.Shutdown()

	// Multiple changes
	sm.NotifyChange("change 1")
	sm.NotifyChange("change 2")
	sm.NotifyChange("change 3")
	sm.NotifyChange("change 4")
	sm.NotifyChange("change 5")

	assert.Equal(t, 5, sm.GetPendingChangesCount())

	// Force sync should batch all changes
	sm.ForceSync()

	assert.False(t, sm.HasPendingChanges())

	// Verify commit message shows batch
	log, err := getGitLog(tempDir)
	require.NoError(t, err)
	assert.Contains(t, log, "auto: 5 changes")
}

func TestSyncManager_LoadsLastCommitTimeOnStartup(t *testing.T) {
	tempDir := t.TempDir()

	cleanup := setupTestConfig(t, tempDir, config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		CommitInterval: 10,
	})
	defer cleanup()

	database := setupTestDB(t, tempDir)

	// Manually insert a last commit time (store in UTC as the code does)
	expectedTime := time.Now().Add(-5 * time.Minute).Truncate(time.Second)
	_, err := database.Exec(
		"INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
		"last_auto_sync",
		expectedTime.UTC().Format(time.RFC3339),
	)
	require.NoError(t, err)

	// Create sync manager - should load the time
	sm := NewSyncManager(database)
	defer sm.Shutdown()

	sm.mu.Lock()
	loadedTime := sm.lastCommitTime.Truncate(time.Second)
	sm.mu.Unlock()

	// Compare Unix timestamps to avoid timezone issues
	assert.Equal(t, expectedTime.Unix(), loadedTime.Unix())
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
