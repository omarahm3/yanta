// Package backup provides automatic backup functionality for YANTA data.
// It creates timestamped backups of the vault and database before sync operations
// and manages backup retention according to configured limits.
package backup

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"yanta/internal/config"
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

// Wails-compatible methods (exposed to frontend)

// GetBackups returns a list of available backups for the frontend
func (s *Service) GetBackups(ctx context.Context) ([]BackupInfo, error) {
	dataDir := config.GetDataDirectory()

	logger.WithField("dataDir", dataDir).Debug("listing backups for frontend")

	backups, err := s.ListBackups(dataDir)
	if err != nil {
		logger.WithError(err).Error("failed to list backups")
		return nil, fmt.Errorf("failed to list backups: %w", err)
	}

	return backups, nil
}

// Restore restores data from a specific backup
func (s *Service) Restore(ctx context.Context, backupPath string) error {
	dataDir := config.GetDataDirectory()

	logger.WithFields(map[string]any{
		"dataDir":    dataDir,
		"backupPath": backupPath,
	}).Info("restoring backup from frontend")

	if err := s.RestoreBackup(dataDir, backupPath); err != nil {
		logger.WithError(err).Error("failed to restore backup")
		return fmt.Errorf("failed to restore backup: %w", err)
	}

	return nil
}

// Delete deletes a specific backup
func (s *Service) Delete(ctx context.Context, backupPath string) error {
	logger.WithField("backupPath", backupPath).Info("deleting backup from frontend")

	if err := s.DeleteBackup(backupPath); err != nil {
		logger.WithError(err).Error("failed to delete backup")
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	return nil
}

// GetConfig returns the current backup configuration
func (s *Service) GetConfig(ctx context.Context) (config.BackupConfig, error) {
	logger.Debug("getting backup configuration")

	cfg := config.GetBackupConfig()

	return cfg, nil
}

// SetConfig updates the backup configuration
func (s *Service) SetConfig(ctx context.Context, cfg config.BackupConfig) error {
	logger.WithFields(map[string]any{
		"enabled":    cfg.Enabled,
		"maxBackups": cfg.MaxBackups,
	}).Info("updating backup configuration from frontend")

	if err := config.SetBackupConfig(cfg); err != nil {
		logger.WithError(err).Error("failed to set backup configuration")
		return fmt.Errorf("failed to set backup configuration: %w", err)
	}

	return nil
}

// copyFile copies a single file from src to dst with optimized buffering
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer sourceFile.Close()

	sourceInfo, err := sourceFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat source file: %w", err)
	}

	destFile, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destFile.Close()

	// Use larger buffer (64KB) for better I/O throughput
	buffer := make([]byte, 64*1024)
	if _, err := io.CopyBuffer(destFile, sourceFile, buffer); err != nil {
		return fmt.Errorf("failed to copy file contents: %w", err)
	}

	// Sync to ensure data is written to disk
	if err := destFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync destination file: %w", err)
	}

	// Copy file permissions
	if err := os.Chmod(dst, sourceInfo.Mode()); err != nil {
		return fmt.Errorf("failed to set file permissions: %w", err)
	}

	return nil
}

// copyDir recursively copies a directory from src to dst with concurrent file copying
func copyDir(src, dst string) error {
	// Validate source directory exists
	sourceInfo, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("failed to stat source directory: %w", err)
	}
	if !sourceInfo.IsDir() {
		return fmt.Errorf("source is not a directory: %s", src)
	}

	// First pass: create all directories (sequential - must complete first)
	err = filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}
		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}
		return nil
	})
	if err != nil {
		return err
	}

	// Second pass: copy all files concurrently
	const maxWorkers = 8
	semaphore := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup
	var copyErr error
	var errMu sync.Mutex

	err = filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories (already created)
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}
		dstPath := filepath.Join(dst, relPath)

		// Launch worker to copy this file
		wg.Add(1)
		semaphore <- struct{}{} // Acquire worker slot

		go func(srcPath, dstPath string, mode os.FileMode) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release worker slot

			if err := copyFile(srcPath, dstPath); err != nil {
				errMu.Lock()
				if copyErr == nil {
					copyErr = fmt.Errorf("failed to copy %s: %w", srcPath, err)
				}
				errMu.Unlock()
			}
		}(path, dstPath, info.Mode())

		return nil
	})

	wg.Wait() // Wait for all workers to complete

	if err != nil {
		return err
	}
	if copyErr != nil {
		return copyErr
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
