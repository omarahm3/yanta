package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"yanta/internal/config"
	"yanta/internal/logger"
	"yanta/internal/paths"
)

// setupTestDataDir creates a test data directory with vault and database
func setupTestDataDir(t *testing.T) string {
	t.Helper()

	dataDir := t.TempDir()

	// Set YANTA_DATA_DIR for the test
	oldDataDir := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", dataDir)
	t.Cleanup(func() {
		if oldDataDir == "" {
			os.Unsetenv("YANTA_DATA_DIR")
		} else {
			os.Setenv("YANTA_DATA_DIR", oldDataDir)
		}
	})

	// Create vault directory with test file
	vaultPath := filepath.Join(dataDir, "vault")
	err := os.MkdirAll(vaultPath, 0755)
	require.NoError(t, err)

	testFile := filepath.Join(vaultPath, "test-file.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)

	// Create database file
	dbPath := filepath.Join(dataDir, "yanta.db")
	err = os.WriteFile(dbPath, []byte("fake db content"), 0644)
	require.NoError(t, err)

	return dataDir
}

func TestCreateBackup_Success(t *testing.T) {
	service := NewService()
	dataDir := setupTestDataDir(t)

	// Ensure logger is closed after test to release file handles (Windows)
	t.Cleanup(func() {
		logger.Close()
	})

	t.Run("creates backup successfully", func(t *testing.T) {
		err := service.CreateBackup(dataDir)
		require.NoError(t, err)

		// Verify backup directory was created
		backupsPath := paths.GetBackupsPath()
		assert.DirExists(t, backupsPath)

		// Verify at least one backup exists
		entries, err := os.ReadDir(backupsPath)
		require.NoError(t, err)
		assert.NotEmpty(t, entries)

		// Verify backup contains vault and database
		if len(entries) > 0 {
			backupPath := filepath.Join(backupsPath, entries[0].Name())
			assert.DirExists(t, filepath.Join(backupPath, "vault"))
			assert.FileExists(t, filepath.Join(backupPath, "yanta.db"))

			// Verify vault file was copied
			testFile := filepath.Join(backupPath, "vault", "test-file.txt")
			assert.FileExists(t, testFile)
			content, err := os.ReadFile(testFile)
			require.NoError(t, err)
			assert.Equal(t, "test content", string(content))

			// Verify database was copied
			dbContent, err := os.ReadFile(filepath.Join(backupPath, "yanta.db"))
			require.NoError(t, err)
			assert.Equal(t, "fake db content", string(dbContent))
		}
	})
}

func TestCreateBackup_ValidationErrors(t *testing.T) {
	service := NewService()

	tests := []struct {
		name    string
		dataDir string
		setup   func(t *testing.T) string
		wantErr string
	}{
		{
			name:    "empty data directory path",
			dataDir: "",
			setup:   func(t *testing.T) string { return "" },
			wantErr: "data directory path is empty",
		},
		{
			name:    "whitespace data directory path",
			dataDir: "   ",
			setup:   func(t *testing.T) string { return "   " },
			wantErr: "data directory path is empty",
		},
		{
			name:    "non-existent data directory",
			dataDir: "/nonexistent/path/to/data",
			setup: func(t *testing.T) string {
				return "/nonexistent/path/to/data"
			},
			wantErr: "data directory does not exist",
		},
		{
			name: "data directory is a file",
			setup: func(t *testing.T) string {
				tempDir := t.TempDir()
				filePath := filepath.Join(tempDir, "notadir")
				err := os.WriteFile(filePath, []byte("test"), 0644)
				require.NoError(t, err)
				return filePath
			},
			wantErr: "data directory path is not a directory",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var dataDir string
			if tt.setup != nil {
				dataDir = tt.setup(t)
			} else {
				dataDir = tt.dataDir
			}

			err := service.CreateBackup(dataDir)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestListBackups(t *testing.T) {
	service := NewService()

	t.Run("empty list when no backups exist", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Empty(t, backups)
	})

	t.Run("lists backups sorted by timestamp", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		// Create multiple backups with known timestamps
		backupsPath := paths.GetBackupsPath()
		err := os.MkdirAll(backupsPath, 0755)
		require.NoError(t, err)

		timestamps := []string{
			"2024-01-01_10-00-00",
			"2024-01-02_10-00-00",
			"2024-01-03_10-00-00",
		}

		for _, ts := range timestamps {
			backupDir := filepath.Join(backupsPath, ts)
			err := os.MkdirAll(backupDir, 0755)
			require.NoError(t, err)

			// Add a file to calculate size
			testFile := filepath.Join(backupDir, "test.txt")
			err = os.WriteFile(testFile, []byte("test"), 0644)
			require.NoError(t, err)
		}

		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Len(t, backups, 3)

		// Verify sorted newest first
		assert.Equal(t, "2024-01-03_10-00-00", filepath.Base(backups[0].Path))
		assert.Equal(t, "2024-01-02_10-00-00", filepath.Base(backups[1].Path))
		assert.Equal(t, "2024-01-01_10-00-00", filepath.Base(backups[2].Path))

		// Verify timestamps are parsed correctly
		expectedTime, _ := time.Parse("2006-01-02_15-04-05", "2024-01-03_10-00-00")
		assert.Equal(t, expectedTime, backups[0].Timestamp)

		// Verify size is calculated
		for _, backup := range backups {
			assert.Greater(t, backup.Size, int64(0))
		}
	})

	t.Run("skips directories with invalid timestamp format", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		backupsPath := paths.GetBackupsPath()
		err := os.MkdirAll(backupsPath, 0755)
		require.NoError(t, err)

		// Create valid backup
		validBackup := filepath.Join(backupsPath, "2024-01-01_10-00-00")
		err = os.MkdirAll(validBackup, 0755)
		require.NoError(t, err)

		// Create directories with invalid formats
		invalidBackups := []string{
			"invalid-name",
			"2024-13-01_10-00-00", // Invalid month
			"not-a-timestamp",
		}

		for _, name := range invalidBackups {
			invalidDir := filepath.Join(backupsPath, name)
			err = os.MkdirAll(invalidDir, 0755)
			require.NoError(t, err)
		}

		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)

		// Should only include the valid backup
		assert.Len(t, backups, 1)
		assert.Equal(t, validBackup, backups[0].Path)
	})

	t.Run("empty data directory path", func(t *testing.T) {
		_, err := service.ListBackups("")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "data directory path is empty")
	})
}

func TestRestoreBackup_Success(t *testing.T) {
	service := NewService()
	dataDir := setupTestDataDir(t)

	// Create a backup first
	err := service.CreateBackup(dataDir)
	require.NoError(t, err)

	// Get the backup path
	backups, err := service.ListBackups(dataDir)
	require.NoError(t, err)
	require.NotEmpty(t, backups)
	backupPath := backups[0].Path

	t.Run("restores backup successfully", func(t *testing.T) {
		// Modify vault to verify restore
		vaultPath := paths.GetVaultPath()
		testFile := filepath.Join(vaultPath, "test-file.txt")
		err := os.WriteFile(testFile, []byte("modified content"), 0644)
		require.NoError(t, err)

		// Restore backup
		err = service.RestoreBackup(dataDir, backupPath)
		require.NoError(t, err)

		// Verify original content is restored
		content, err := os.ReadFile(testFile)
		require.NoError(t, err)
		assert.Equal(t, "test content", string(content))

		// Verify database is restored
		dbPath := paths.GetDatabasePath()
		dbContent, err := os.ReadFile(dbPath)
		require.NoError(t, err)
		assert.Equal(t, "fake db content", string(dbContent))
	})
}

func TestRestoreBackup_ValidationErrors(t *testing.T) {
	service := NewService()

	tests := []struct {
		name       string
		dataDir    string
		backupPath string
		setup      func(t *testing.T) (string, string)
		wantErr    string
	}{
		{
			name:       "empty data directory path",
			dataDir:    "",
			backupPath: "/some/path",
			setup:      func(t *testing.T) (string, string) { return "", "/some/path" },
			wantErr:    "data directory path is empty",
		},
		{
			name:    "empty backup path",
			dataDir: "data",
			setup: func(t *testing.T) (string, string) {
				return setupTestDataDir(t), ""
			},
			wantErr: "backup path is empty",
		},
		{
			name: "non-existent backup path",
			setup: func(t *testing.T) (string, string) {
				return setupTestDataDir(t), "/nonexistent/backup"
			},
			wantErr: "backup does not exist",
		},
		{
			name: "backup path is a file",
			setup: func(t *testing.T) (string, string) {
				dataDir := setupTestDataDir(t)
				tempDir := t.TempDir()
				filePath := filepath.Join(tempDir, "notadir")
				err := os.WriteFile(filePath, []byte("test"), 0644)
				require.NoError(t, err)
				return dataDir, filePath
			},
			wantErr: "backup path is not a directory",
		},
		{
			name: "backup missing vault directory",
			setup: func(t *testing.T) (string, string) {
				dataDir := setupTestDataDir(t)
				backupDir := t.TempDir()
				// Create only database file
				dbPath := filepath.Join(backupDir, "yanta.db")
				err := os.WriteFile(dbPath, []byte("test"), 0644)
				require.NoError(t, err)
				return dataDir, backupDir
			},
			wantErr: "backup is missing vault directory",
		},
		{
			name: "backup missing database file",
			setup: func(t *testing.T) (string, string) {
				dataDir := setupTestDataDir(t)
				backupDir := t.TempDir()
				// Create only vault directory
				vaultPath := filepath.Join(backupDir, "vault")
				err := os.MkdirAll(vaultPath, 0755)
				require.NoError(t, err)
				return dataDir, backupDir
			},
			wantErr: "backup is missing database file",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var dataDir, backupPath string
			if tt.setup != nil {
				dataDir, backupPath = tt.setup(t)
			} else {
				dataDir = tt.dataDir
				backupPath = tt.backupPath
			}

			err := service.RestoreBackup(dataDir, backupPath)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestDeleteBackup(t *testing.T) {
	service := NewService()

	t.Run("deletes backup successfully", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		// Create a backup
		err := service.CreateBackup(dataDir)
		require.NoError(t, err)

		// Get the backup path
		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		require.Len(t, backups, 1)
		backupPath := backups[0].Path

		// Delete the backup
		err = service.DeleteBackup(backupPath)
		require.NoError(t, err)

		// Verify backup is deleted
		assert.NoDirExists(t, backupPath)

		// Verify no backups remain
		backups, err = service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Empty(t, backups)
	})

	t.Run("empty backup path", func(t *testing.T) {
		err := service.DeleteBackup("")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "backup path is empty")
	})

	t.Run("non-existent backup", func(t *testing.T) {
		err := service.DeleteBackup("/nonexistent/backup")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "backup does not exist")
	})

	t.Run("backup path is not a directory", func(t *testing.T) {
		tempDir := t.TempDir()
		filePath := filepath.Join(tempDir, "notadir")
		err := os.WriteFile(filePath, []byte("test"), 0644)
		require.NoError(t, err)

		err = service.DeleteBackup(filePath)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "backup path is not a directory")
	})

	t.Run("backup path outside backups directory", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		// Try to delete a directory outside the backups directory
		outsideDir := t.TempDir()
		err := service.DeleteBackup(outsideDir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "backup path is outside backups directory")

		// Verify the directory still exists (wasn't deleted)
		assert.DirExists(t, outsideDir)

		// Silence unused variable warning
		_ = dataDir
	})
}

func TestPruneOldBackups(t *testing.T) {
	service := NewService()

	t.Run("keeps only max backups", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		// Create 5 backups with different timestamps
		backupsPath := paths.GetBackupsPath()
		err := os.MkdirAll(backupsPath, 0755)
		require.NoError(t, err)

		timestamps := []string{
			"2024-01-01_10-00-00",
			"2024-01-02_10-00-00",
			"2024-01-03_10-00-00",
			"2024-01-04_10-00-00",
			"2024-01-05_10-00-00",
		}

		for _, ts := range timestamps {
			backupDir := filepath.Join(backupsPath, ts)
			err := os.MkdirAll(backupDir, 0755)
			require.NoError(t, err)
		}

		// Prune to keep only 3 backups
		err = service.PruneOldBackups(dataDir, 3)
		require.NoError(t, err)

		// Verify only 3 most recent backups remain
		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Len(t, backups, 3)

		// Verify the newest backups are kept
		assert.Equal(t, "2024-01-05_10-00-00", filepath.Base(backups[0].Path))
		assert.Equal(t, "2024-01-04_10-00-00", filepath.Base(backups[1].Path))
		assert.Equal(t, "2024-01-03_10-00-00", filepath.Base(backups[2].Path))

		// Verify the oldest backups are deleted
		assert.NoDirExists(t, filepath.Join(backupsPath, "2024-01-01_10-00-00"))
		assert.NoDirExists(t, filepath.Join(backupsPath, "2024-01-02_10-00-00"))
	})

	t.Run("does nothing when backup count is within limit", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		// Create 2 backups
		backupsPath := paths.GetBackupsPath()
		err := os.MkdirAll(backupsPath, 0755)
		require.NoError(t, err)

		for _, ts := range []string{"2024-01-01_10-00-00", "2024-01-02_10-00-00"} {
			backupDir := filepath.Join(backupsPath, ts)
			err := os.MkdirAll(backupDir, 0755)
			require.NoError(t, err)
		}

		// Prune with max of 5 (more than we have)
		err = service.PruneOldBackups(dataDir, 5)
		require.NoError(t, err)

		// Verify both backups still exist
		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Len(t, backups, 2)
	})

	t.Run("invalid maxBackups value", func(t *testing.T) {
		dataDir := setupTestDataDir(t)

		tests := []struct {
			name       string
			maxBackups int
		}{
			{"zero", 0},
			{"negative", -1},
			{"large negative", -100},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := service.PruneOldBackups(dataDir, tt.maxBackups)
				require.Error(t, err)
				assert.Contains(t, err.Error(), "maxBackups must be greater than 0")
			})
		}
	})
}

func TestCopyFile(t *testing.T) {
	t.Run("copies file successfully", func(t *testing.T) {
		tempDir := t.TempDir()
		srcPath := filepath.Join(tempDir, "source.txt")
		dstPath := filepath.Join(tempDir, "dest.txt")

		content := []byte("test file content")
		err := os.WriteFile(srcPath, content, 0644)
		require.NoError(t, err)

		err = copyFile(srcPath, dstPath)
		require.NoError(t, err)

		// Verify destination file exists and has correct content
		assert.FileExists(t, dstPath)
		dstContent, err := os.ReadFile(dstPath)
		require.NoError(t, err)
		assert.Equal(t, content, dstContent)

		// Verify permissions are copied
		srcInfo, _ := os.Stat(srcPath)
		dstInfo, _ := os.Stat(dstPath)
		assert.Equal(t, srcInfo.Mode(), dstInfo.Mode())
	})

	t.Run("error on non-existent source", func(t *testing.T) {
		tempDir := t.TempDir()
		err := copyFile(
			filepath.Join(tempDir, "nonexistent.txt"),
			filepath.Join(tempDir, "dest.txt"),
		)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to open source file")
	})
}

func TestCopyDir(t *testing.T) {
	t.Run("copies directory recursively", func(t *testing.T) {
		tempDir := t.TempDir()
		srcDir := filepath.Join(tempDir, "source")
		dstDir := filepath.Join(tempDir, "dest")

		// Create source directory structure
		err := os.MkdirAll(filepath.Join(srcDir, "subdir"), 0755)
		require.NoError(t, err)

		// Create files
		err = os.WriteFile(filepath.Join(srcDir, "file1.txt"), []byte("content1"), 0644)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(srcDir, "subdir", "file2.txt"), []byte("content2"), 0644)
		require.NoError(t, err)

		// Copy directory
		err = copyDir(srcDir, dstDir)
		require.NoError(t, err)

		// Verify destination structure
		assert.DirExists(t, dstDir)
		assert.DirExists(t, filepath.Join(dstDir, "subdir"))
		assert.FileExists(t, filepath.Join(dstDir, "file1.txt"))
		assert.FileExists(t, filepath.Join(dstDir, "subdir", "file2.txt"))

		// Verify file contents
		content1, err := os.ReadFile(filepath.Join(dstDir, "file1.txt"))
		require.NoError(t, err)
		assert.Equal(t, "content1", string(content1))

		content2, err := os.ReadFile(filepath.Join(dstDir, "subdir", "file2.txt"))
		require.NoError(t, err)
		assert.Equal(t, "content2", string(content2))
	})

	t.Run("error on non-existent source", func(t *testing.T) {
		tempDir := t.TempDir()
		err := copyDir(
			filepath.Join(tempDir, "nonexistent"),
			filepath.Join(tempDir, "dest"),
		)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to stat source directory")
	})
}

func TestCalculateDirSize(t *testing.T) {
	t.Run("calculates directory size correctly", func(t *testing.T) {
		tempDir := t.TempDir()

		// Create files with known sizes
		file1 := filepath.Join(tempDir, "file1.txt")
		file2 := filepath.Join(tempDir, "file2.txt")

		content1 := []byte("12345") // 5 bytes
		content2 := []byte("1234567890") // 10 bytes

		err := os.WriteFile(file1, content1, 0644)
		require.NoError(t, err)
		err = os.WriteFile(file2, content2, 0644)
		require.NoError(t, err)

		size, err := calculateDirSize(tempDir)
		require.NoError(t, err)
		assert.Equal(t, int64(15), size)
	})

	t.Run("includes subdirectories", func(t *testing.T) {
		tempDir := t.TempDir()

		// Create nested structure
		subDir := filepath.Join(tempDir, "subdir")
		err := os.MkdirAll(subDir, 0755)
		require.NoError(t, err)

		err = os.WriteFile(filepath.Join(tempDir, "file1.txt"), []byte("12345"), 0644)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(subDir, "file2.txt"), []byte("1234567890"), 0644)
		require.NoError(t, err)

		size, err := calculateDirSize(tempDir)
		require.NoError(t, err)
		assert.Equal(t, int64(15), size)
	})

	t.Run("returns zero for empty directory", func(t *testing.T) {
		tempDir := t.TempDir()

		size, err := calculateDirSize(tempDir)
		require.NoError(t, err)
		assert.Equal(t, int64(0), size)
	})

	t.Run("error on non-existent path", func(t *testing.T) {
		_, err := calculateDirSize("/nonexistent/path")
		require.Error(t, err)
	})
}

func TestBackupIntegration(t *testing.T) {
	// This test verifies a complete backup workflow
	service := NewService()
	dataDir := setupTestDataDir(t)

	t.Run("complete backup workflow", func(t *testing.T) {
		// 1. Create initial backup
		err := service.CreateBackup(dataDir)
		require.NoError(t, err)

		// 2. Verify backup was created
		backups, err := service.ListBackups(dataDir)
		require.NoError(t, err)
		require.Len(t, backups, 1)
		initialBackup := backups[0]

		// 3. Modify data
		vaultPath := paths.GetVaultPath()
		modifiedFile := filepath.Join(vaultPath, "modified.txt")
		err = os.WriteFile(modifiedFile, []byte("modified content"), 0644)
		require.NoError(t, err)

		// 4. Create second backup
		time.Sleep(time.Second) // Ensure different timestamp
		err = service.CreateBackup(dataDir)
		require.NoError(t, err)

		// 5. Verify two backups exist
		backups, err = service.ListBackups(dataDir)
		require.NoError(t, err)
		require.Len(t, backups, 2)

		// 6. Prune to keep only 1 backup
		err = service.PruneOldBackups(dataDir, 1)
		require.NoError(t, err)

		// 7. Verify only newest backup remains
		backups, err = service.ListBackups(dataDir)
		require.NoError(t, err)
		require.Len(t, backups, 1)
		assert.True(t, backups[0].Timestamp.After(initialBackup.Timestamp))

		// 8. Delete remaining backup
		err = service.DeleteBackup(backups[0].Path)
		require.NoError(t, err)

		// 9. Verify no backups remain
		backups, err = service.ListBackups(dataDir)
		require.NoError(t, err)
		assert.Empty(t, backups)
	})
}

// TestBackupWithDataDirectoryChange tests backup behavior when YANTA_DATA_DIR changes
func TestBackupWithDataDirectoryChange(t *testing.T) {
	service := NewService()

	// Setup first data directory
	dataDir1 := t.TempDir()
	oldEnv := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", dataDir1)
	defer func() {
		if oldEnv == "" {
			os.Unsetenv("YANTA_DATA_DIR")
		} else {
			os.Setenv("YANTA_DATA_DIR", oldEnv)
		}
	}()

	// Create vault and database in first location
	vaultPath1 := filepath.Join(dataDir1, "vault")
	err := os.MkdirAll(vaultPath1, 0755)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(vaultPath1, "file1.txt"), []byte("data1"), 0644)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(dataDir1, "yanta.db"), []byte("db1"), 0644)
	require.NoError(t, err)

	// Create backup
	err = service.CreateBackup(dataDir1)
	require.NoError(t, err)

	// Verify backup was created
	backups, err := service.ListBackups(dataDir1)
	require.NoError(t, err)
	assert.Len(t, backups, 1)

	// Verify backup location is within the data directory
	assert.Contains(t, backups[0].Path, config.GetDataDirectory())
}
