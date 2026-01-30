package integration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

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

func TestBackupRetentionPolicy(t *testing.T) {
	ensureGitAvailable(t)

	dataDir := t.TempDir()
	initGitRepo(t, dataDir)

	tempHome := t.TempDir()
	overrideHome(t, tempHome)

	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(dataDir))

	// Enable git sync and set MaxBackups to 3
	require.NoError(t, config.SetGitSyncConfig(config.GitSyncConfig{
		Enabled:        true,
		AutoCommit:     true,
		AutoPush:       false,
		CommitInterval: 1,
	}))

	require.NoError(t, config.SetBackupConfig(config.BackupConfig{
		Enabled:    true,
		MaxBackups: 3, // Only keep 3 most recent backups
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

	backupService := backup.NewService()

	// Create 5 syncs to generate 5 backups
	// Each sync needs a change to trigger backup creation
	for i := 1; i <= 5; i++ {
		// Create a project to trigger a change
		projectName := fmt.Sprintf("Project %d", i)
		projectAlias := fmt.Sprintf("proj%d", i)
		_, err = service.Create(context.Background(), projectName, projectAlias, "", "")
		require.NoError(t, err)

		// Verify pending changes exist
		require.True(t, syncManager.HasPendingChanges(), "expected pending changes after project creation")

		// Force sync (this should trigger backup creation)
		syncManager.ForceSync()

		// Small delay to ensure timestamps are different
		// (backup directory names are timestamped to the second)
		time.Sleep(1100 * time.Millisecond)
	}

	// Verify only 3 most recent backups exist
	backups, err := backupService.ListBackups(dataDir)
	require.NoError(t, err)
	require.Len(t, backups, 3, "should have exactly 3 backups (retention policy enforced)")

	// Verify backups are the most recent ones (backups 5, 4, 3)
	// backups list is sorted newest first
	backupsPath := paths.GetBackupsPath()
	entries, err := os.ReadDir(backupsPath)
	require.NoError(t, err)
	require.Len(t, entries, 3, "backups directory should contain exactly 3 backup directories")

	// Verify each remaining backup has a valid structure
	for _, backup := range backups {
		// Each backup should contain vault directory
		vaultPath := filepath.Join(backup.Path, "vault")
		require.DirExists(t, vaultPath, "backup should contain vault directory")

		// Each backup should contain database file
		dbBackupPath := filepath.Join(backup.Path, "yanta.db")
		require.FileExists(t, dbBackupPath, "backup should contain yanta.db file")

		// Database should not be empty
		dbInfo, err := os.Stat(dbBackupPath)
		require.NoError(t, err)
		require.Greater(t, dbInfo.Size(), int64(0), "backed up database should not be empty")
	}

	// Verify the timestamps of remaining backups are the most recent
	// The oldest kept backup should be from the 3rd sync (project 3)
	// Backups from syncs 1 and 2 should have been deleted
	require.Equal(t, 3, len(backups), "exactly 3 backups should remain")

	// Verify the backup timestamps are unique and sorted correctly
	for i := 0; i < len(backups)-1; i++ {
		require.True(t, backups[i].Timestamp.After(backups[i+1].Timestamp),
			"backups should be sorted newest first")
	}

	// Verify git log shows all 5 sync commits
	log := runGit(t, dataDir, "log", "--oneline")
	for i := 1; i <= 5; i++ {
		projectAlias := fmt.Sprintf("@proj%d", i)
		require.Contains(t, log, projectAlias, "git log should contain commit for project %d", i)
	}
}

func TestBackupPerformance(t *testing.T) {
	ensureGitAvailable(t)

	dataDir := t.TempDir()
	initGitRepo(t, dataDir)

	tempHome := t.TempDir()
	overrideHome(t, tempHome)

	config.ResetForTesting()
	require.NoError(t, config.Init())
	require.NoError(t, config.SetDataDirectory(dataDir))

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

	// Create a realistic vault with multiple projects and files
	// Target: 300+ files, 25MB total size
	t.Log("Creating realistic vault with ~300 files, ~25MB...")

	numProjects := 10
	filesPerProject := 30 // Total: 300 files
	fileSizeKB := 85      // Each file ~85KB = 25.5MB total

	for i := 1; i <= numProjects; i++ {
		projectName := fmt.Sprintf("Performance Test Project %d", i)
		projectAlias := fmt.Sprintf("perftest%d", i)
		projectID, err := service.Create(context.Background(), projectName, projectAlias, "", "")
		require.NoError(t, err)

		// Create multiple files in each project
		projectVaultPath := filepath.Join(dataDir, "vault", projectAlias)
		// Ensure directory exists
		err = os.MkdirAll(projectVaultPath, 0755)
		require.NoError(t, err)

		for j := 1; j <= filesPerProject; j++ {
			fileName := fmt.Sprintf("document-%d.md", j)
			filePath := filepath.Join(projectVaultPath, fileName)

			// Create file with content (approximately fileSizeKB in size)
			content := fmt.Sprintf("# Document %d in Project %d\n\n", j, i)
			// Pad content to reach desired size
			paddingSize := (fileSizeKB * 1024) - len(content)
			if paddingSize > 0 {
				// Generate padding with repeated text to simulate realistic markdown content
				padding := make([]byte, paddingSize)
				paragraph := "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n"
				for k := 0; k < paddingSize; k++ {
					padding[k] = paragraph[k%len(paragraph)]
				}
				content += string(padding)
			}

			err = os.WriteFile(filePath, []byte(content), 0644)
			require.NoError(t, err)
		}

		t.Logf("Created project %d with %d files", i, filesPerProject)
		_ = projectID // Use the variable
	}

	// Calculate actual vault size
	vaultPath := filepath.Join(dataDir, "vault")
	vaultSize, err := calculateDirSize(vaultPath)
	require.NoError(t, err)
	vaultSizeMB := float64(vaultSize) / (1024 * 1024)
	t.Logf("Vault size: %.2f MB", vaultSizeMB)

	// Count total files
	totalFiles := 0
	err = filepath.Walk(vaultPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalFiles++
		}
		return nil
	})
	require.NoError(t, err)
	t.Logf("Total files: %d", totalFiles)

	// Close database to ensure all data is flushed to disk
	db.CloseDB(database)

	// Test 1: Measure backup creation time
	t.Log("Measuring backup creation time...")
	backupService := backup.NewService()

	backupStartTime := time.Now()
	err = backupService.CreateBackup(dataDir)
	backupDuration := time.Since(backupStartTime)
	require.NoError(t, err)

	t.Logf("Backup creation time: %.3f seconds", backupDuration.Seconds())
	require.Less(t, backupDuration.Seconds(), 5.0, "Backup creation should complete in under 5 seconds")

	// Get the backup path for restore test
	backups, err := backupService.ListBackups(dataDir)
	require.NoError(t, err)
	require.NotEmpty(t, backups, "backup should exist")
	backupPath := backups[0].Path

	// Verify backup size is reasonable
	backupSize, err := calculateDirSize(backupPath)
	require.NoError(t, err)
	backupSizeMB := float64(backupSize) / (1024 * 1024)
	t.Logf("Backup size: %.2f MB", backupSizeMB)

	// Test 2: Measure restore time
	t.Log("Measuring backup restore time...")

	restoreStartTime := time.Now()
	err = backupService.RestoreBackup(dataDir, backupPath)
	restoreDuration := time.Since(restoreStartTime)
	require.NoError(t, err)

	t.Logf("Backup restore time: %.3f seconds", restoreDuration.Seconds())
	require.Less(t, restoreDuration.Seconds(), 5.0, "Backup restore should complete in under 5 seconds")

	// Verify restore was successful by checking a sample file
	sampleFilePath := filepath.Join(dataDir, "vault", "perftest1", "document-1.md")
	require.FileExists(t, sampleFilePath, "restored vault should contain sample file")

	// Verify database was restored
	dbRestorePath := filepath.Join(dataDir, "yanta.db")
	require.FileExists(t, dbRestorePath, "database should be restored")

	// Log summary
	t.Logf("\n=== Performance Test Summary ===")
	t.Logf("Vault: %d files, %.2f MB", totalFiles, vaultSizeMB)
	t.Logf("Backup creation: %.3f seconds (requirement: < 5s)", backupDuration.Seconds())
	t.Logf("Backup restore: %.3f seconds (requirement: < 5s)", restoreDuration.Seconds())
	t.Logf("Backup size: %.2f MB", backupSizeMB)

	// Both operations should complete in under 5 seconds total
	totalTime := backupDuration + restoreDuration
	t.Logf("Total time: %.3f seconds", totalTime.Seconds())

	// Final assertions
	require.Less(t, backupDuration.Seconds(), 5.0, "Backup creation exceeded 5 second requirement")
	require.Less(t, restoreDuration.Seconds(), 5.0, "Backup restore exceeded 5 second requirement")
}

// calculateDirSize calculates the total size of all files in a directory recursively
func calculateDirSize(path string) (int64, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}
