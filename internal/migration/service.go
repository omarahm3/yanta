// Package migration handles data migration between YANTA data directories.
package migration

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"yanta/internal/config"
	"yanta/internal/logger"
)

type GitService interface {
	CheckInstalled() (bool, error)
	IsRepository(path string) (bool, error)
	Init(path string) error
	CreateGitIgnore(path string, patterns []string) error
	AddAll(path string) error
	Commit(path, message string) error
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

func (s *Service) MigrateData(targetPath string) error {
	logger.Infof("starting data migration to %s", targetPath)

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

	if err := os.MkdirAll(absTarget, 0755); err != nil {
		return fmt.Errorf("creating target directory: %w", err)
	}

	if hasCurrentData {
		return s.migrateExistingData(currentAbs, absTarget)
	}

	if hasTargetVault {
		return s.initializeWithExistingVault(absTarget)
	}

	return s.initializeFreshVault(absTarget)
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
	isRepo, err := s.gitService.IsRepository(targetPath)
	if err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("checking git repository: %w", err)
	}

	if !isRepo {
		logger.Info("initializing git repository")
		if err := s.gitService.Init(targetPath); err != nil {
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
	if err := s.gitService.AddAll(targetPath); err != nil {
		if originalDataDir != "" {
			_ = s.rollback(targetPath, originalDataDir)
		}
		return fmt.Errorf("git add failed: %w", err)
	}

	logger.Info("creating initial commit")
	commitMsg := "chore: init YANTA directory"
	if err := s.gitService.Commit(targetPath, commitMsg); err != nil {
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

func (s *Service) verifyIntegrity(srcDir, dstDir string) error {
	srcCount := 0
	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			srcCount++
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("walking source directory: %w", err)
	}

	dstCount := 0
	err = filepath.Walk(dstDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			dstCount++
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("walking destination directory: %w", err)
	}

	if srcCount != dstCount {
		return fmt.Errorf("file count mismatch: source=%d, destination=%d", srcCount, dstCount)
	}

	return nil
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
