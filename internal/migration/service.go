// Package migration handles data migration between YANTA data directories.
package migration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"yanta/internal/config"
	"yanta/internal/git"
	"yanta/internal/logger"
)

// ErrMigrationNeedsRestart wraps a migration failure that occurred AFTER the
// shared database connection was closed. The app cannot recover its DB handle
// in-process, so the caller must restart the app to return to a working state.
var ErrMigrationNeedsRestart = errors.New("migration failed after database was closed; app restart required")

type GitService interface {
	CheckInstalled() (bool, error)
	IsRepository(path string) (bool, error)
	Init(ctx context.Context, path string) error
	CreateGitIgnore(path string, patterns []string) error
	Add(ctx context.Context, path string, pathspecs ...string) error
	Commit(ctx context.Context, path, message string) error
}

type Service struct {
	database   *sql.DB
	gitService GitService
}

func NewService(database *sql.DB, gitService GitService) *Service {
	return &Service{
		database:   database,
		gitService: gitService,
	}
}

func (s *Service) ValidateTargetDirectory(targetPath string) error {
	absPath, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("resolving absolute path: %w", err)
	}

	currentDataDir := config.GetDataDirectory()
	currentAbs, err := filepath.Abs(currentDataDir)
	if err != nil {
		return fmt.Errorf("resolving current data directory: %w", err)
	}

	if absPath == currentAbs {
		return fmt.Errorf("target directory is same as current data directory")
	}

	info, err := os.Stat(absPath)
	if os.IsNotExist(err) {
		parentDir := filepath.Dir(absPath)
		parentInfo, err := os.Stat(parentDir)
		if err != nil {
			return fmt.Errorf("parent directory not accessible: %w", err)
		}
		if !parentInfo.IsDir() {
			return fmt.Errorf("parent path is not a directory")
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("accessing target directory: %w", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("target path is not a directory")
	}

	targetVaultPath := filepath.Join(absPath, "vault")
	if _, err := os.Stat(targetVaultPath); err == nil {
		logger.Info("target has existing vault - will use vault files from target directory")
	}

	return nil
}

// CheckMigrationConflicts detects if both local and target have vault data,
// and returns statistics for both vaults.
func (s *Service) CheckMigrationConflicts(targetPath string) (*MigrationConflictInfo, error) {
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return nil, fmt.Errorf("resolving target path: %w", err)
	}

	currentDataDir := config.GetDataDirectory()
	currentAbs, err := filepath.Abs(currentDataDir)
	if err != nil {
		return nil, fmt.Errorf("resolving current data directory: %w", err)
	}

	info := &MigrationConflictInfo{
		HasConflict: false,
		LocalPath:   currentAbs,
		TargetPath:  absTarget,
	}

	// Check local vault
	localVaultPath := filepath.Join(currentAbs, "vault")
	hasLocalVault := false
	if _, err := os.Stat(localVaultPath); err == nil {
		hasLocalVault = true
		stats, err := s.getVaultStats(localVaultPath)
		if err != nil {
			logger.Warnf("failed to get local vault stats: %v", err)
		} else {
			info.LocalVault = stats
		}
	}

	// Check target vault
	targetVaultPath := filepath.Join(absTarget, "vault")
	hasTargetVault := false
	if _, err := os.Stat(targetVaultPath); err == nil {
		hasTargetVault = true
		stats, err := s.getVaultStats(targetVaultPath)
		if err != nil {
			logger.Warnf("failed to get target vault stats: %v", err)
		} else {
			info.TargetVault = stats
		}
	}

	// Conflict exists when both have vault data
	info.HasConflict = hasLocalVault && hasTargetVault

	return info, nil
}

// getVaultStats calculates statistics for a vault directory.
func (s *Service) getVaultStats(vaultPath string) (*VaultStats, error) {
	stats := &VaultStats{}

	projectsPath := filepath.Join(vaultPath, "projects")
	if _, err := os.Stat(projectsPath); err == nil {
		// Count projects (directories in projects/)
		entries, err := os.ReadDir(projectsPath)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					stats.ProjectCount++
					// Count documents in each project
					projectPath := filepath.Join(projectsPath, entry.Name())
					docEntries, err := os.ReadDir(projectPath)
					if err == nil {
						for _, docEntry := range docEntries {
							if !docEntry.IsDir() {
								stats.DocumentCount++
							}
						}
					}
				}
			}
		}
	}

	// Calculate total size
	err := filepath.Walk(vaultPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}
		if !info.IsDir() {
			stats.TotalSize += info.Size()
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walking vault directory: %w", err)
	}

	stats.TotalSizeHuman = formatBytes(stats.TotalSize)

	return stats, nil
}

// formatBytes converts bytes to human-readable format.
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func (s *Service) MigrateData(targetPath string, strategy MigrationStrategy) error {
	logger.Infof("starting data migration to %s with strategy %s", targetPath, strategy)

	// Validate strategy if provided
	if strategy != "" && !strategy.IsValid() {
		return fmt.Errorf("invalid migration strategy: %s", strategy)
	}

	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return fmt.Errorf("resolving target path: %w", err)
	}

	if err := s.ValidateTargetDirectory(absTarget); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	installed, err := s.gitService.CheckInstalled()
	if err != nil || !installed {
		return fmt.Errorf("git is not installed or not found in PATH")
	}

	currentDataDir := config.GetDataDirectory()
	currentAbs, err := filepath.Abs(currentDataDir)
	if err != nil {
		return fmt.Errorf("resolving current data directory: %w", err)
	}
	logger.Infof("current data directory: %s", currentAbs)

	// Determine migration scenario
	currentVaultPath := filepath.Join(currentAbs, "vault")
	hasCurrentData := false
	if _, err := os.Stat(currentVaultPath); err == nil {
		hasCurrentData = true
	}

	targetVaultPath := filepath.Join(absTarget, "vault")
	hasTargetVault := false
	if _, err := os.Stat(targetVaultPath); err == nil {
		hasTargetVault = true
	}

	// Close database before any operations
	if s.database != nil {
		logger.Info("closing database connection")
		if err := s.database.Close(); err != nil {
			logger.Warnf("error closing database: %v", err)
		}
	}

	// The database is now closed, so every failure past this point requires an
	// app restart to recover a working handle — wrap it so the caller reacts.
	if err := os.MkdirAll(absTarget, 0755); err != nil {
		return fmt.Errorf("%w: creating target directory: %v", ErrMigrationNeedsRestart, err)
	}

	var migErr error
	switch {
	case hasCurrentData && hasTargetVault:
		migErr = s.migrateWithStrategy(currentAbs, absTarget, strategy)
	case hasCurrentData:
		migErr = s.migrateExistingData(currentAbs, absTarget)
	case hasTargetVault:
		migErr = s.initializeWithExistingVault(absTarget)
	default:
		migErr = s.initializeFreshVault(absTarget)
	}
	if migErr != nil {
		return fmt.Errorf("%w: %v", ErrMigrationNeedsRestart, migErr)
	}
	return nil
}

// migrateWithStrategy handles migration when both local and target have vault data.
func (s *Service) migrateWithStrategy(currentDataDir, targetPath string, strategy MigrationStrategy) error {
	logger.Infof("resolving vault conflict with strategy: %s", strategy)

	switch strategy {
	case StrategyUseRemote:
		return s.strategyUseRemote(currentDataDir, targetPath)
	case StrategyUseLocal:
		return s.strategyUseLocal(currentDataDir, targetPath)
	case StrategyMergeBoth:
		return s.strategyMergeBoth(currentDataDir, targetPath)
	default:
		// Default to use_remote for backwards compatibility
		logger.Info("no strategy specified, defaulting to use_remote")
		return s.strategyUseRemote(currentDataDir, targetPath)
	}
}

// strategyUseRemote keeps the target vault and discards local data.
func (s *Service) strategyUseRemote(currentDataDir, targetPath string) error {
	logger.Info("strategy: use_remote - keeping target vault, discarding local")

	// Remove database in target (will be rebuilt from vault)
	targetDBPath := filepath.Join(targetPath, "yanta.db")
	if _, err := os.Stat(targetDBPath); err == nil {
		logger.Info("removing existing database from target - will rebuild from vault files")
		if err := os.Remove(targetDBPath); err != nil {
			logger.Warnf("failed to remove existing database: %v", err)
		}
	}

	return s.setupGitRepository(targetPath, currentDataDir)
}

// strategyUseLocal copies local vault to target, overwriting target data.
func (s *Service) strategyUseLocal(currentDataDir, targetPath string) error {
	logger.Info("strategy: use_local - copying local vault to target")

	targetVaultPath := filepath.Join(targetPath, "vault")
	backupPath := filepath.Join(targetPath, "vault.backup")

	// Backup target vault
	if _, err := os.Stat(targetVaultPath); err == nil {
		logger.Infof("backing up target vault to %s", backupPath)
		// Remove old backup if exists
		if _, err := os.Stat(backupPath); err == nil {
			if err := os.RemoveAll(backupPath); err != nil {
				return fmt.Errorf("removing old backup: %w", err)
			}
		}
		if err := os.Rename(targetVaultPath, backupPath); err != nil {
			return fmt.Errorf("backing up target vault: %w", err)
		}
	}

	// Copy local vault to target
	localVaultPath := filepath.Join(currentDataDir, "vault")
	logger.Infof("copying local vault: %s -> %s", localVaultPath, targetVaultPath)
	if err := s.copyDirectory(localVaultPath, targetVaultPath); err != nil {
		// Attempt to restore backup
		if _, err := os.Stat(backupPath); err == nil {
			_ = os.RemoveAll(targetVaultPath)
			_ = os.Rename(backupPath, targetVaultPath)
		}
		return fmt.Errorf("copying local vault: %w", err)
	}

	// Verify integrity
	logger.Info("verifying vault integrity")
	if err := s.verifyIntegrity(localVaultPath, targetVaultPath); err != nil {
		// Attempt to restore backup
		if _, err := os.Stat(backupPath); err == nil {
			_ = os.RemoveAll(targetVaultPath)
			_ = os.Rename(backupPath, targetVaultPath)
		}
		return fmt.Errorf("integrity verification failed: %w", err)
	}

	// Remove backup after successful copy
	if _, err := os.Stat(backupPath); err == nil {
		logger.Info("removing vault backup after successful migration")
		if err := os.RemoveAll(backupPath); err != nil {
			logger.Warnf("failed to remove backup: %v", err)
		}
	}

	// Remove database in target (will be rebuilt from vault)
	targetDBPath := filepath.Join(targetPath, "yanta.db")
	if _, err := os.Stat(targetDBPath); err == nil {
		logger.Info("removing existing database from target - will rebuild from vault files")
		if err := os.Remove(targetDBPath); err != nil {
			logger.Warnf("failed to remove existing database: %v", err)
		}
	}

	return s.setupGitRepository(targetPath, currentDataDir)
}

// strategyMergeBoth copies local files that don't exist in target.
func (s *Service) strategyMergeBoth(currentDataDir, targetPath string) error {
	logger.Info("strategy: merge_both - merging local files into target")

	localVaultPath := filepath.Join(currentDataDir, "vault")
	targetVaultPath := filepath.Join(targetPath, "vault")

	// Walk local vault and copy files that don't exist in target
	err := filepath.Walk(localVaultPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Get relative path from vault root
		relPath, err := filepath.Rel(localVaultPath, path)
		if err != nil {
			return err
		}

		targetFilePath := filepath.Join(targetVaultPath, relPath)

		if info.IsDir() {
			// Create directory if it doesn't exist
			if _, err := os.Stat(targetFilePath); os.IsNotExist(err) {
				logger.Debugf("creating directory: %s", targetFilePath)
				if err := os.MkdirAll(targetFilePath, info.Mode()); err != nil {
					return fmt.Errorf("creating directory %s: %w", targetFilePath, err)
				}
			}
		} else {
			// Copy file only if it doesn't exist in target
			if _, err := os.Stat(targetFilePath); os.IsNotExist(err) {
				logger.Debugf("copying file: %s -> %s", path, targetFilePath)
				// Ensure parent directory exists
				parentDir := filepath.Dir(targetFilePath)
				if err := os.MkdirAll(parentDir, 0755); err != nil {
					return fmt.Errorf("creating parent directory: %w", err)
				}
				if err := s.copyFile(path, targetFilePath); err != nil {
					return fmt.Errorf("copying file %s: %w", path, err)
				}
			} else {
				logger.Debugf("skipping existing file: %s", targetFilePath)
			}
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("merging vaults: %w", err)
	}

	// Remove database in target (will be rebuilt from vault)
	targetDBPath := filepath.Join(targetPath, "yanta.db")
	if _, err := os.Stat(targetDBPath); err == nil {
		logger.Info("removing existing database from target - will rebuild from vault files")
		if err := os.Remove(targetDBPath); err != nil {
			logger.Warnf("failed to remove existing database: %v", err)
		}
	}

	return s.setupGitRepository(targetPath, currentDataDir)
}

func (s *Service) migrateExistingData(currentDataDir, targetPath string) error {
	logger.Info("migrating existing data to new location")

	targetVaultPath := filepath.Join(targetPath, "vault")
	targetHasVault := false
	if _, err := os.Stat(targetVaultPath); err == nil {
		targetHasVault = true
		logger.Info("target already has vault - will use existing vault files")
	}

	if !targetHasVault {
		vaultSrc := filepath.Join(currentDataDir, "vault")
		if _, err := os.Stat(vaultSrc); err == nil {
			logger.Infof("copying vault: %s -> %s", vaultSrc, targetVaultPath)
			if err := s.copyDirectory(vaultSrc, targetVaultPath); err != nil {
				_ = s.rollback(targetPath, currentDataDir)
				return fmt.Errorf("copying vault data: %w", err)
			}

			logger.Info("verifying vault integrity")
			if err := s.verifyIntegrity(vaultSrc, targetVaultPath); err != nil {
				_ = s.rollback(targetPath, currentDataDir)
				return fmt.Errorf("integrity verification failed: %w", err)
			}
		} else {
			logger.Info("current directory has no vault - will create empty vault structure")
		}
	}

	targetDBPath := filepath.Join(targetPath, "yanta.db")
	if _, err := os.Stat(targetDBPath); err == nil {
		logger.Info("removing existing database from target - will rebuild from vault files")
		if err := os.Remove(targetDBPath); err != nil {
			logger.Warnf("failed to remove existing database: %v", err)
		}
	}

	return s.setupGitRepository(targetPath, currentDataDir)
}

func (s *Service) initializeWithExistingVault(targetPath string) error {
	logger.Info("initializing YANTA with existing vault files")

	dbPath := filepath.Join(targetPath, "yanta.db")
	if _, err := os.Stat(dbPath); err == nil {
		logger.Info("removing existing database - will rebuild from vault files")
		if err := os.Remove(dbPath); err != nil {
			return fmt.Errorf("removing existing database: %w", err)
		}
	}

	return s.setupGitRepository(targetPath, "")
}

func (s *Service) initializeFreshVault(targetPath string) error {
	logger.Info("initializing fresh YANTA vault")

	vaultPath := filepath.Join(targetPath, "vault")
	projectsPath := filepath.Join(vaultPath, "projects")
	if err := os.MkdirAll(projectsPath, 0755); err != nil {
		return fmt.Errorf("creating vault structure: %w", err)
	}

	return s.setupGitRepository(targetPath, "")
}

func (s *Service) setupGitRepository(targetPath, originalDataDir string) error {
	ctx := context.Background()

	isRepo, err := s.gitService.IsRepository(targetPath)
	if err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("checking git repository: %w", err)
	}

	if !isRepo {
		logger.Info("initializing git repository")
		if err := s.gitService.Init(ctx, targetPath); err != nil {
			if originalDataDir != "" {
				_ = s.rollback(targetPath, originalDataDir)
			}
			return fmt.Errorf("git init failed: %w", err)
		}
	}

	logger.Info("creating .gitignore")
	patterns := []string{
		"# YANTA - Disposable files",
		"yanta.db*",
		"",
		"# Local pre-sync backups (machine-local, never synced)",
		".backups/",
		"",
		"# WebView / OS runtime junk (machine-local, never synced)",
		"*.marker",
		".DS_Store",
		"Thumbs.db",
		"desktop.ini",
		"EBWebView/",
		"",
		"# Logs",
		"*.log",
	}
	if err := s.gitService.CreateGitIgnore(targetPath, patterns); err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("creating .gitignore: %w", err)
	}

	logger.Info("staging files for initial commit")
	// Stage only synced content so the initial commit never captures the
	// database, backups, or runtime junk.
	if err := s.gitService.Add(ctx, targetPath, git.SyncPaths...); err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("git add failed: %w", err)
	}

	logger.Info("creating initial commit")
	commitMsg := "chore: init YANTA directory"
	if err := s.gitService.Commit(ctx, targetPath, commitMsg); err != nil {
		// If nothing to commit, that's okay
		if err.Error() != "nothing to commit" {
			if originalDataDir != "" {
				_ = s.rollback(targetPath, originalDataDir)
			}
			return fmt.Errorf("git commit failed: %w", err)
		}
	}

	logger.Info("updating configuration")
	if err := config.SetDataDirectory(targetPath); err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("updating config: %w", err)
	}

	logger.Info("migration completed successfully")
	return nil
}

func (s *Service) copyDirectory(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := s.copyDirectory(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := s.copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Service) copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	srcInfo, err := srcFile.Stat()
	if err != nil {
		return err
	}

	dstFile, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, srcInfo.Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}

	return dstFile.Sync()
}

// verifyIntegrity confirms every source file exists in the destination with a
// matching size (not just a matching file count, which a truncated copy could
// pass). The destination may contain extra files (e.g. a new .git directory).
func (s *Service) verifyIntegrity(srcDir, dstDir string) error {
	srcFiles, err := fileSizes(srcDir)
	if err != nil {
		return fmt.Errorf("walking source directory: %w", err)
	}
	dstFiles, err := fileSizes(dstDir)
	if err != nil {
		return fmt.Errorf("walking destination directory: %w", err)
	}

	for rel, srcSize := range srcFiles {
		dstSize, ok := dstFiles[rel]
		if !ok {
			return fmt.Errorf("missing file in destination: %s", rel)
		}
		if dstSize != srcSize {
			return fmt.Errorf("size mismatch for %s: source=%d, destination=%d", rel, srcSize, dstSize)
		}
	}

	return nil
}

// fileSizes maps each file's path (relative to dir) to its size.
func fileSizes(dir string) (map[string]int64, error) {
	files := make(map[string]int64)
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		rel, relErr := filepath.Rel(dir, path)
		if relErr != nil {
			return relErr
		}
		files[rel] = info.Size()
		return nil
	})
	return files, err
}

func (s *Service) rollback(targetPath, originalDataDir string) error {
	logger.Warnf("rolling back migration from %s", targetPath)

	vaultPath := filepath.Join(targetPath, "vault")
	if err := os.RemoveAll(vaultPath); err != nil {
		logger.Errorf("failed to remove vault during rollback: %v", err)
	}

	dbPath := filepath.Join(targetPath, "yanta.db")
	if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
		logger.Errorf("failed to remove database during rollback: %v", err)
	}

	if err := config.SetDataDirectory(originalDataDir); err != nil {
		logger.Errorf("failed to restore original data directory: %v", err)
		return err
	}

	logger.Info("rollback completed")
	return nil
}
