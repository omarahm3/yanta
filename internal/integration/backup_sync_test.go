package integration

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/logger"
	"yanta/internal/paths"
	"yanta/internal/project"
	"yanta/internal/vault"
)

func TestBackupCreationOnSync(t *testing.T) {
	ensureGitAvailable(t)

	dataDir := t.TempDir()
	initGitRepo(t, dataDir)

	tempHome := t.TempDir()
	overrideHome(t, tempHome)

	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(dataDir))

	// Enable git sync
	require.NoError(t, config.SetGitSyncConfig(config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		AutoPush:       false,
		CommitInterval: 1,
	}))

	// Enable backup
	require.NoError(t, config.SetBackupConfig(config.BackupConfig{
		Enabled:    true,
		MaxBackups: 10,
	}))

	dbPath := filepath.Join(dataDir, "yanta.db")
	database, err := db.OpenDB(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		db.CloseDB(database)
		logger.Close()
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

	// Create a project to trigger a change
	_, err = service.Create(context.Background(), "Backup Test Project", "backuptest", "", "")
	require.NoError(t, err)

	// Verify pending changes exist
	require.True(t, syncManager.HasPendingChanges(), "expected pending changes after project creation")

	// Force sync (this should trigger backup creation)
	syncManager.ForceSync()

	// Verify backup was created
	backupsPath := paths.GetBackupsPath()
	require.DirExists(t, backupsPath, "backups directory should exist")

	entries, err := os.ReadDir(backupsPath)
	require.NoError(t, err)
	require.NotEmpty(t, entries, "at least one backup should exist")

	// Get the most recent backup (should be the only one)
	backupDir := filepath.Join(backupsPath, entries[len(entries)-1].Name())

	// Verify backup contains vault/ directory
	vaultBackupPath := filepath.Join(backupDir, "vault")
	require.DirExists(t, vaultBackupPath, "backup should contain vault directory")

	// Verify backup contains yanta.db file
	dbBackupPath := filepath.Join(backupDir, "yanta.db")
	require.FileExists(t, dbBackupPath, "backup should contain yanta.db file")

	// Verify database backup is not empty
	dbInfo, err := os.Stat(dbBackupPath)
	require.NoError(t, err)
	require.Greater(t, dbInfo.Size(), int64(0), "backed up database should not be empty")

	// Verify the sync completed successfully after backup
	log := runGit(t, dataDir, "log", "--oneline", "-1")
	require.Contains(t, log, "project @backuptest metadata created", "expected auto-sync commit after backup")
}

func TestBackupDisabledNoBackupCreated(t *testing.T) {
	ensureGitAvailable(t)

	dataDir := t.TempDir()
	initGitRepo(t, dataDir)

	tempHome := t.TempDir()
	overrideHome(t, tempHome)

	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(dataDir))

	// Enable git sync but DISABLE backup
	require.NoError(t, config.SetGitSyncConfig(config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		AutoPush:       false,
		CommitInterval: 1,
	}))

	require.NoError(t, config.SetBackupConfig(config.BackupConfig{
		Enabled:    false, // Disabled
		MaxBackups: 10,
	}))

	dbPath := filepath.Join(dataDir, "yanta.db")
	database, err := db.OpenDB(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		db.CloseDB(database)
		logger.Close()
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

	// Create a project to trigger a change
	_, err = service.Create(context.Background(), "No Backup Test", "nobackup", "", "")
	require.NoError(t, err)

	// Verify pending changes exist
	require.True(t, syncManager.HasPendingChanges(), "expected pending changes after project creation")

	// Force sync (should NOT create backup since backup is disabled)
	syncManager.ForceSync()

	// Verify NO backup was created
	backupsPath := paths.GetBackupsPath()
	// Directory might not even exist, or if it does, should be empty
	if _, err := os.Stat(backupsPath); err == nil {
		entries, err := os.ReadDir(backupsPath)
		require.NoError(t, err)
		require.Empty(t, entries, "no backups should exist when backup is disabled")
	}

	// Verify the sync completed successfully even without backup
	log := runGit(t, dataDir, "log", "--oneline", "-1")
	require.Contains(t, log, "project @nobackup metadata created", "expected auto-sync commit even without backup")
}
