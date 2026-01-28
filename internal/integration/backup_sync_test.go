package integration

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/backup"
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

func TestBackupRestoration(t *testing.T) {
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

	// Disable automatic backup during sync for this test
	// (we're testing manual backup/restore, not backup-on-sync)
	require.NoError(t, config.SetBackupConfig(config.BackupConfig{
		Enabled:    false,
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

	// Step 1: Create initial data (a project with a document)
	initialProjectID, err := service.Create(context.Background(), "Initial Project", "initial", "", "")
	require.NoError(t, err)

	// Create a document in the initial project
	initialDocPath := filepath.Join(dataDir, "vault", "initial", "test-doc.md")
	initialDocContent := "# Initial Document\n\nThis is the initial content."
	require.NoError(t, os.MkdirAll(filepath.Dir(initialDocPath), 0755))
	require.NoError(t, os.WriteFile(initialDocPath, []byte(initialDocContent), 0644))

	// Force sync to ensure data is committed
	require.True(t, syncManager.HasPendingChanges(), "expected pending changes after document creation")
	syncManager.ForceSync()

	// Step 2: Close database to ensure all data is flushed to disk before backup
	db.CloseDB(database)

	// Create a backup
	backupService := backup.NewService()
	err = backupService.CreateBackup(dataDir)
	require.NoError(t, err)

	// Reopen database after backup
	database, err = db.OpenDB(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		db.CloseDB(database)
	})

	// Recreate stores and service with new database connection
	projectStore = project.NewStore(database)
	projectCache = project.NewCache(projectStore)
	service = project.NewService(
		database,
		projectStore,
		projectCache,
		v,
		syncManager,
		events.NewEventBus(),
	)

	// Get the backup path
	backups, err := backupService.ListBackups(dataDir)
	require.NoError(t, err)
	require.NotEmpty(t, backups, "backup should exist")
	backupPath := backups[0].Path

	// Verify backup contains expected data
	backupDocPath := filepath.Join(backupPath, "vault", "initial", "test-doc.md")
	require.FileExists(t, backupDocPath, "backup should contain the initial document")
	backupDocContent, err := os.ReadFile(backupDocPath)
	require.NoError(t, err)
	require.Equal(t, initialDocContent, string(backupDocContent), "backup document content should match original")

	// Step 3: Make document changes (modify existing, create new project)
	modifiedDocContent := "# Modified Document\n\nThis content has been changed."
	require.NoError(t, os.WriteFile(initialDocPath, []byte(modifiedDocContent), 0644))

	// Create a new project after the backup
	newProjectID, err := service.Create(context.Background(), "New Project", "newproj", "", "")
	require.NoError(t, err)
	require.NotEmpty(t, newProjectID)

	// Verify the changes exist in the current state
	currentDocContent, err := os.ReadFile(initialDocPath)
	require.NoError(t, err)
	require.Equal(t, modifiedDocContent, string(currentDocContent), "document should be modified")

	projectsAfterChange, err := projectStore.Get(context.Background(), &project.GetFilters{})
	require.NoError(t, err)
	require.Len(t, projectsAfterChange, 2, "should have 2 projects before restore")

	// Step 4: Close database before restore (required for restore operation)
	db.CloseDB(database)

	// Step 5: Restore from backup
	err = backupService.RestoreBackup(dataDir, backupPath)
	require.NoError(t, err)

	// Step 6: Reopen database after restore
	database, err = db.OpenDB(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		db.CloseDB(database)
	})

	// Run migrations on restored database (in case migrations were added after backup)
	require.NoError(t, db.RunMigrations(database))

	// Verify document reverted to backup state
	restoredDocContent, err := os.ReadFile(initialDocPath)
	require.NoError(t, err)
	require.Equal(t, initialDocContent, string(restoredDocContent), "document should be restored to initial content")

	// Verify new project is gone (database restored)
	projectStore = project.NewStore(database)
	projectCache = project.NewCache(projectStore)
	restoredService := project.NewService(
		database,
		projectStore,
		projectCache,
		v,
		syncManager,
		events.NewEventBus(),
	)

	projectsAfterRestore, err := projectStore.Get(context.Background(), &project.GetFilters{})
	require.NoError(t, err)
	require.Len(t, projectsAfterRestore, 1, "should have only 1 project after restore")
	require.Equal(t, initialProjectID, projectsAfterRestore[0].ID, "restored project should match initial project")

	// Verify no data corruption by querying the database
	var count int
	err = database.QueryRow("SELECT COUNT(*) FROM project").Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 1, count, "database should have exactly 1 project")

	// Verify the restored project has correct data
	restoredProject, err := restoredService.Get(context.Background(), initialProjectID)
	require.NoError(t, err)
	require.Equal(t, "Initial Project", restoredProject.Name, "restored project name should match")
	require.Equal(t, "@initial", restoredProject.Alias, "restored project alias should match")
}
