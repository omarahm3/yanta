package backup

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBackupService_Create(t *testing.T) {
	// Setup: Create temporary test environment
	tempDir, err := os.MkdirTemp("", "backup_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	// Clean up, but ignore errors on Windows due to logger file locking
	defer os.RemoveAll(tempDir)

	// Override data directory for testing
	oldDataDir := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", tempDir)
	defer os.Setenv("YANTA_DATA_DIR", oldDataDir)

	// Create mock vault and database
	vaultPath := filepath.Join(tempDir, "vault")
	dbPath := filepath.Join(tempDir, "yanta.db")

	if err := os.MkdirAll(vaultPath, 0755); err != nil {
		t.Fatalf("failed to create mock vault: %v", err)
	}

	// Create some test files in vault
	testFile := filepath.Join(vaultPath, "test.md")
	testContent := []byte("# Test Document\nThis is a test document.")
	if err = os.WriteFile(testFile, testContent, 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	// Create mock database file
	dbContent := []byte("mock database content")
	if err := os.WriteFile(dbPath, dbContent, 0644); err != nil {
		t.Fatalf("failed to create mock database: %v", err)
	}

	// Test: Create backup
	service := NewService()
	err = service.CreateBackup(tempDir)
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Verify: Backup directory was created
	backupsPath := filepath.Join(tempDir, "backups")
	entries, err := os.ReadDir(backupsPath)
	if err != nil {
		t.Fatalf("failed to read backups directory: %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("expected 1 backup, got %d", len(entries))
	}

	backupDir := entries[0].Name()
	backupPath := filepath.Join(backupsPath, backupDir)

	// Verify: Backup contains vault directory
	vaultBackup := filepath.Join(backupPath, "vault")
	if _, err := os.Stat(vaultBackup); os.IsNotExist(err) {
		t.Fatalf("backup missing vault directory")
	}

	// Verify: Backup contains database file
	dbBackup := filepath.Join(backupPath, "yanta.db")
	if _, err := os.Stat(dbBackup); os.IsNotExist(err) {
		t.Fatalf("backup missing database file")
	}

	// Verify: Test file exists in backup
	testFileBackup := filepath.Join(vaultBackup, "test.md")
	if _, err := os.Stat(testFileBackup); os.IsNotExist(err) {
		t.Fatalf("backup missing test file")
	}

	// Verify: Test file content matches
	backupContent, err := os.ReadFile(testFileBackup)
	if err != nil {
		t.Fatalf("failed to read backup test file: %v", err)
	}

	if string(backupContent) != string(testContent) {
		t.Fatalf("backup content mismatch: expected %q, got %q", testContent, backupContent)
	}
}

func TestBackupService_List(t *testing.T) {
	// Setup: Create temporary test environment
	tempDir := t.TempDir()

	oldDataDir := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", tempDir)
	defer os.Setenv("YANTA_DATA_DIR", oldDataDir)

	// Create mock vault and database
	vaultPath := filepath.Join(tempDir, "vault")
	dbPath := filepath.Join(tempDir, "yanta.db")

	if err := os.MkdirAll(vaultPath, 0755); err != nil {
		t.Fatalf("failed to create mock vault: %v", err)
	}

	if err := os.WriteFile(dbPath, []byte("mock db"), 0644); err != nil {
		t.Fatalf("failed to create mock database: %v", err)
	}

	// Create multiple backups
	service := NewService()

	for i := 0; i < 3; i++ {
		if err := service.CreateBackup(tempDir); err != nil {
			t.Fatalf("CreateBackup failed: %v", err)
		}
		time.Sleep(2 * time.Second) // Ensure different timestamps
	}

	// Test: List backups
	backups, err := service.ListBackups(tempDir)
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 3 {
		t.Fatalf("expected 3 backups, got %d", len(backups))
	}

	// Verify: Backups are sorted by timestamp (newest first)
	for i := 0; i < len(backups)-1; i++ {
		if backups[i].Timestamp.Before(backups[i+1].Timestamp) {
			t.Fatalf("backups not sorted correctly: backup[%d] is older than backup[%d]", i, i+1)
		}
	}

	// Verify: Each backup has required fields
	for i, backup := range backups {
		if backup.Path == "" {
			t.Fatalf("backup[%d] has empty path", i)
		}

		if backup.Size <= 0 {
			t.Fatalf("backup[%d] has invalid size: %d", i, backup.Size)
		}

		if backup.Timestamp.IsZero() {
			t.Fatalf("backup[%d] has zero timestamp", i)
		}
	}
}

func TestBackupService_Restore(t *testing.T) {
	// Setup: Create temporary test environment
	tempDir := t.TempDir()

	oldDataDir := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", tempDir)
	defer os.Setenv("YANTA_DATA_DIR", oldDataDir)

	// Create mock vault and database with original content
	vaultPath := filepath.Join(tempDir, "vault")
	dbPath := filepath.Join(tempDir, "yanta.db")

	if err := os.MkdirAll(vaultPath, 0755); err != nil {
		t.Fatalf("failed to create mock vault: %v", err)
	}

	originalContent := []byte("# Original Document")
	testFile := filepath.Join(vaultPath, "test.md")
	if err := os.WriteFile(testFile, originalContent, 0644); err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}

	originalDBContent := []byte("original database")
	if err := os.WriteFile(dbPath, originalDBContent, 0644); err != nil {
		t.Fatalf("failed to create mock database: %v", err)
	}

	// Create backup
	service := NewService()
	if err := service.CreateBackup(tempDir); err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Get backup path
	backups, err := service.ListBackups(tempDir)
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 1 {
		t.Fatalf("expected 1 backup, got %d", len(backups))
	}

	backupPath := backups[0].Path

	// Modify original files
	modifiedContent := []byte("# Modified Document")
	if err := os.WriteFile(testFile, modifiedContent, 0644); err != nil {
		t.Fatalf("failed to modify test file: %v", err)
	}

	modifiedDBContent := []byte("modified database")
	if err := os.WriteFile(dbPath, modifiedDBContent, 0644); err != nil {
		t.Fatalf("failed to modify database: %v", err)
	}

	// Test: Restore backup
	if err := service.RestoreBackup(tempDir, backupPath); err != nil {
		t.Fatalf("RestoreBackup failed: %v", err)
	}

	// Verify: Original content is restored
	restoredContent, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("failed to read restored test file: %v", err)
	}

	if string(restoredContent) != string(originalContent) {
		t.Fatalf("restored content mismatch: expected %q, got %q", originalContent, restoredContent)
	}

	// Verify: Database is restored
	restoredDBContent, err := os.ReadFile(dbPath)
	if err != nil {
		t.Fatalf("failed to read restored database: %v", err)
	}

	if string(restoredDBContent) != string(originalDBContent) {
		t.Fatalf("restored database mismatch: expected %q, got %q", originalDBContent, restoredDBContent)
	}
}

func TestBackupService_Delete(t *testing.T) {
	// Setup: Create temporary test environment
	tempDir := t.TempDir()

	oldDataDir := os.Getenv("YANTA_DATA_DIR")
	os.Setenv("YANTA_DATA_DIR", tempDir)
	defer os.Setenv("YANTA_DATA_DIR", oldDataDir)

	// Create mock vault and database
	vaultPath := filepath.Join(tempDir, "vault")
	dbPath := filepath.Join(tempDir, "yanta.db")

	if err := os.MkdirAll(vaultPath, 0755); err != nil {
		t.Fatalf("failed to create mock vault: %v", err)
	}

	if err := os.WriteFile(dbPath, []byte("mock db"), 0644); err != nil {
		t.Fatalf("failed to create mock database: %v", err)
	}

	// Create backup
	service := NewService()
	if err := service.CreateBackup(tempDir); err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Get backup path
	backups, err := service.ListBackups(tempDir)
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 1 {
		t.Fatalf("expected 1 backup, got %d", len(backups))
	}

	backupPath := backups[0].Path

	// Test: Delete backup
	if err := service.DeleteBackup(backupPath); err != nil {
		t.Fatalf("DeleteBackup failed: %v", err)
	}

	// Verify: Backup directory is deleted
	if _, err := os.Stat(backupPath); !os.IsNotExist(err) {
		t.Fatalf("backup directory still exists after deletion")
	}

	// Verify: No backups remain
	backups, err = service.ListBackups(tempDir)
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}

	if len(backups) != 0 {
		t.Fatalf("expected 0 backups, got %d", len(backups))
	}
}
