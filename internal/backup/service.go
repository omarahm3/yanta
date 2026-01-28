package backup

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"yanta/internal/logger"
	"yanta/internal/paths"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
}

// CreateBackup creates a timestamped backup of the data directory
func (s *Service) CreateBackup(dataDir string) error {
	if strings.TrimSpace(dataDir) == "" {
		return fmt.Errorf("data directory path is empty")
	}

	// Validate data directory exists
	info, err := os.Stat(dataDir)
	if os.IsNotExist(err) {
		return fmt.Errorf("data directory does not exist: %s", dataDir)
	}
	if err != nil {
		return fmt.Errorf("cannot access data directory %q: %w", dataDir, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("data directory path is not a directory: %s", dataDir)
	}

	// Create backups directory if it doesn't exist
	backupsPath := paths.GetBackupsPath()
	if err := os.MkdirAll(backupsPath, 0755); err != nil {
		return fmt.Errorf("failed to create backups directory: %w", err)
	}

	// Create timestamped backup directory
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupPath := filepath.Join(backupsPath, timestamp)

	if err := os.MkdirAll(backupPath, 0755); err != nil {
		return fmt.Errorf("failed to create backup directory: %w", err)
	}

	logger.WithFields(map[string]any{
		"dataDir":    dataDir,
		"backupPath": backupPath,
	}).Info("creating backup")

	// Copy vault directory
	vaultSrc := paths.GetVaultPath()
	vaultDest := filepath.Join(backupPath, "vault")
	if err := copyDir(vaultSrc, vaultDest); err != nil {
		// Cleanup failed backup
		os.RemoveAll(backupPath)
		return fmt.Errorf("failed to copy vault directory: %w", err)
	}

	// Copy database
	dbSrc := paths.GetDatabasePath()
	dbDest := filepath.Join(backupPath, "yanta.db")
	if err := copyFile(dbSrc, dbDest); err != nil {
		// Cleanup failed backup
		os.RemoveAll(backupPath)
		return fmt.Errorf("failed to copy database: %w", err)
	}

	logger.WithField("backupPath", backupPath).Info("backup created successfully")

	return nil
}

// ListBackups returns a list of available backups, sorted by timestamp (newest first)
func (s *Service) ListBackups(dataDir string) ([]BackupInfo, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("data directory path is empty")
	}

	backupsPath := paths.GetBackupsPath()

	// Check if backups directory exists
	if _, err := os.Stat(backupsPath); os.IsNotExist(err) {
		return []BackupInfo{}, nil
	}

	entries, err := os.ReadDir(backupsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read backups directory: %w", err)
	}

	var backups []BackupInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		backupPath := filepath.Join(backupsPath, entry.Name())

		// Parse timestamp from directory name
		timestamp, err := time.Parse("2006-01-02_15-04-05", entry.Name())
		if err != nil {
			logger.WithFields(map[string]any{
				"dirName": entry.Name(),
				"error":   err.Error(),
			}).Warn("skipping directory with invalid timestamp format")
			continue
		}

		// Calculate backup size
		size, err := calculateDirSize(backupPath)
		if err != nil {
			logger.WithFields(map[string]any{
				"path":  backupPath,
				"error": err.Error(),
			}).Warn("failed to calculate backup size")
			size = 0
		}

		backups = append(backups, BackupInfo{
			Timestamp: timestamp,
			Path:      backupPath,
			Size:      size,
		})
	}

	// Sort by timestamp, newest first
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].Timestamp.After(backups[j].Timestamp)
	})

	return backups, nil
}

// RestoreBackup restores data from a backup
func (s *Service) RestoreBackup(dataDir, backupPath string) error {
	if strings.TrimSpace(dataDir) == "" {
		return fmt.Errorf("data directory path is empty")
	}

	if strings.TrimSpace(backupPath) == "" {
		return fmt.Errorf("backup path is empty")
	}

	// Validate backup path exists
	info, err := os.Stat(backupPath)
	if os.IsNotExist(err) {
		return fmt.Errorf("backup does not exist: %s", backupPath)
	}
	if err != nil {
		return fmt.Errorf("cannot access backup path %q: %w", backupPath, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("backup path is not a directory: %s", backupPath)
	}

	// Validate backup contains required files
	vaultBackup := filepath.Join(backupPath, "vault")
	dbBackup := filepath.Join(backupPath, "yanta.db")

	if _, err := os.Stat(vaultBackup); os.IsNotExist(err) {
		return fmt.Errorf("backup is missing vault directory")
	}

	if _, err := os.Stat(dbBackup); os.IsNotExist(err) {
		return fmt.Errorf("backup is missing database file")
	}

	logger.WithFields(map[string]any{
		"dataDir":    dataDir,
		"backupPath": backupPath,
	}).Info("restoring backup")

	// Remove existing vault
	vaultPath := paths.GetVaultPath()
	if err := os.RemoveAll(vaultPath); err != nil {
		return fmt.Errorf("failed to remove existing vault: %w", err)
	}

	// Restore vault
	if err := copyDir(vaultBackup, vaultPath); err != nil {
		return fmt.Errorf("failed to restore vault directory: %w", err)
	}

	// Restore database
	dbPath := paths.GetDatabasePath()
	if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove existing database: %w", err)
	}

	if err := copyFile(dbBackup, dbPath); err != nil {
		return fmt.Errorf("failed to restore database: %w", err)
	}

	logger.WithField("backupPath", backupPath).Info("backup restored successfully")

	return nil
}

// DeleteBackup deletes a specific backup
func (s *Service) DeleteBackup(backupPath string) error {
	if strings.TrimSpace(backupPath) == "" {
		return fmt.Errorf("backup path is empty")
	}

	// Validate backup path exists
	info, err := os.Stat(backupPath)
	if os.IsNotExist(err) {
		return fmt.Errorf("backup does not exist: %s", backupPath)
	}
	if err != nil {
		return fmt.Errorf("cannot access backup path %q: %w", backupPath, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("backup path is not a directory: %s", backupPath)
	}

	// Ensure backup is within backups directory (safety check)
	backupsPath := paths.GetBackupsPath()
	absBackupPath, err := filepath.Abs(backupPath)
	if err != nil {
		return fmt.Errorf("failed to resolve backup path: %w", err)
	}

	absBackupsPath, err := filepath.Abs(backupsPath)
	if err != nil {
		return fmt.Errorf("failed to resolve backups path: %w", err)
	}

	if !strings.HasPrefix(absBackupPath, absBackupsPath) {
		return fmt.Errorf("backup path is outside backups directory")
	}

	logger.WithField("backupPath", backupPath).Info("deleting backup")

	if err := os.RemoveAll(backupPath); err != nil {
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	logger.WithField("backupPath", backupPath).Info("backup deleted successfully")

	return nil
}

// PruneOldBackups removes old backups keeping only maxBackups most recent ones
func (s *Service) PruneOldBackups(dataDir string, maxBackups int) error {
	if maxBackups <= 0 {
		return fmt.Errorf("maxBackups must be greater than 0")
	}

	// Get list of all backups (sorted newest first)
	backups, err := s.ListBackups(dataDir)
	if err != nil {
		return fmt.Errorf("failed to list backups: %w", err)
	}

	// If we have more backups than allowed, delete the oldest ones
	if len(backups) > maxBackups {
		backupsToDelete := backups[maxBackups:]

		logger.WithFields(map[string]any{
			"totalBackups":   len(backups),
			"maxBackups":     maxBackups,
			"backupsToDelete": len(backupsToDelete),
		}).Info("pruning old backups")

		for _, backup := range backupsToDelete {
			if err := s.DeleteBackup(backup.Path); err != nil {
				logger.WithFields(map[string]any{
					"path":  backup.Path,
					"error": err.Error(),
				}).Warn("failed to delete old backup")
				// Continue deleting other backups even if one fails
				continue
			}
		}

		logger.WithField("deletedCount", len(backupsToDelete)).Info("old backups pruned successfully")
	}

	return nil
}

// copyFile copies a single file from src to dst
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return fmt.Errorf("failed to copy file contents: %w", err)
	}

	// Sync to ensure data is written to disk
	if err := destFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync destination file: %w", err)
	}

	// Copy file permissions
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("failed to stat source file: %w", err)
	}

	if err := os.Chmod(dst, sourceInfo.Mode()); err != nil {
		return fmt.Errorf("failed to set file permissions: %w", err)
	}

	return nil
}

// copyDir recursively copies a directory from src to dst
func copyDir(src, dst string) error {
	// Get source directory info
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("failed to stat source directory: %w", err)
	}

	// Create destination directory
	if err := os.MkdirAll(dst, sourceInfo.Mode()); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return fmt.Errorf("failed to read source directory: %w", err)
	}

	for _, entry := range entries {
		sourcePath := filepath.Join(src, entry.Name())
		destPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// Recursively copy subdirectory
			if err := copyDir(sourcePath, destPath); err != nil {
				return err
			}
		} else {
			// Copy file
			if err := copyFile(sourcePath, destPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// calculateDirSize calculates the total size of a directory
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
