package integration

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/project"
	"yanta/internal/vault"
)

func TestProjectMetadataChangeTriggersGitCommit(t *testing.T) {
	ensureGitAvailable(t)

	dataDir := t.TempDir()
	initGitRepo(t, dataDir)

	tempHome := t.TempDir()
	overrideHome(t, tempHome)

	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(dataDir))
	require.NoError(t, config.SetGitSyncConfig(config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		AutoPush:       false,
		CommitInterval: 1, // 1 minute for faster testing
	}))

	dbPath := filepath.Join(dataDir, "yanta.db")
	database, err := db.OpenDB(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		db.CloseDB(database)
	})
	require.NoError(t, db.RunMigrations(database))

	projectStore := project.NewStore(database)
	projectCache := project.NewCache(projectStore)

	v, err := vault.New(vault.Config{RootPath: filepath.Join(dataDir, "vault")})
	require.NoError(t, err)

	syncManager := git.NewSyncManager(database)
	syncManager.Start()
	t.Cleanup(syncManager.Shutdown)

	service := project.NewService(
		database,
		projectStore,
		projectCache,
		v,
		syncManager,
		events.NewEventBus(),
	)

	_, err = service.Create(context.Background(), "Integration Test", "intsync", "", "")
	require.NoError(t, err)

	// With timer-based model, changes are accumulated and committed at intervals.
	// For testing, we force a sync immediately instead of waiting for the timer.
	require.True(t, syncManager.HasPendingChanges(), "expected pending changes after project creation")
	syncManager.ForceSync()

	// Verify the commit was made
	log := runGit(t, dataDir, "log", "--oneline", "-1")
	require.Contains(t, log, "project @intsync metadata created", "expected auto-sync commit for project metadata change")
}

func ensureGitAvailable(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available: ", err)
	}
}

func initGitRepo(t *testing.T, path string) {
	t.Helper()

	runGit(t, path, "init")
	runGit(t, path, "config", "user.email", "test@example.com")
	runGit(t, path, "config", "user.name", "Test User")

	readme := filepath.Join(path, "README.md")
	require.NoError(t, os.WriteFile(readme, []byte("# Test Repo"), 0o644))

	runGit(t, path, "add", "README.md")
	runGit(t, path, "commit", "-m", "initial commit")
}

func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = dir

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", strings.Join(args, " "), err, string(output))
	}

	return strings.TrimSpace(string(output))
}

func overrideHome(t *testing.T, newHome string) {
	t.Helper()

	origHome := os.Getenv("HOME")
	origUserProfile := os.Getenv("USERPROFILE")

	require.NoError(t, os.Setenv("HOME", newHome))
	require.NoError(t, os.Setenv("USERPROFILE", newHome))

	t.Cleanup(func() {
		os.Setenv("HOME", origHome)
		os.Setenv("USERPROFILE", origUserProfile)
		config.ResetForTesting()
	})
}
