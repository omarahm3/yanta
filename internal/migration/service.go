package migration

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/logger"
)

type GitService interface {
	CheckInstalled() (bool, error)
	IsRepository(path string) (bool, error)
	Init(path string) error
	CreateGitIgnore(path string, patterns []string) error
	AddAll(path string) error
	Commit(path, message string) error
	SetRemote(path, name, url string) error
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

	vaultPath := filepath.Join(absPath, "vault")
	dbPath := filepath.Join(absPath, "yanta.db")

	if _, err := os.Stat(vaultPath); err == nil {
		return fmt.Errorf("target directory contains YANTA data (vault directory exists)")
	}
	if _, err := os.Stat(dbPath); err == nil {
		return fmt.Errorf("target directory contains YANTA data (database exists)")
	}

	return nil
}

func (s *Service) MigrateData(targetPath, remoteURL string) error {
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
	logger.Infof("current data directory: %s", currentDataDir)

	if err := os.MkdirAll(absTarget, 0755); err != nil {
		return fmt.Errorf("creating target directory: %w", err)
	}

	if s.database != nil {
		logger.Info("closing database connection")
		if err := s.database.Close(); err != nil {
			logger.Warnf("error closing database: %v", err)
		}
	}

	vaultSrc := filepath.Join(currentDataDir, "vault")
	vaultDst := filepath.Join(absTarget, "vault")
	logger.Infof("copying vault: %s -> %s", vaultSrc, vaultDst)
	if err := s.copyDirectory(vaultSrc, vaultDst); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("copying vault data: %w", err)
	}

	dbSrc := filepath.Join(currentDataDir, "yanta.db")
	dbDst := filepath.Join(absTarget, "yanta.db")
	logger.Infof("copying database: %s -> %s", dbSrc, dbDst)
	if err := s.copyFile(dbSrc, dbDst); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("copying database: %w", err)
	}

	logger.Info("verifying data integrity")
	if err := s.verifyIntegrity(vaultSrc, vaultDst); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("integrity verification failed: %w", err)
	}

	logger.Info("verifying database can be opened")
	testDB, err := db.OpenDB(dbDst)
	if err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("cannot open migrated database: %w", err)
	}
	testDB.Close()

	isRepo, err := s.gitService.IsRepository(absTarget)
	if err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("checking git repository: %w", err)
	}

	if !isRepo {
		logger.Info("initializing git repository")
		if err := s.gitService.Init(absTarget); err != nil {
			s.rollback(absTarget, currentDataDir)
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
	if err := s.gitService.CreateGitIgnore(absTarget, patterns); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("creating .gitignore: %w", err)
	}

	logger.Info("staging files for initial commit")
	if err := s.gitService.AddAll(absTarget); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("git add failed: %w", err)
	}

	logger.Info("creating initial commit")
	if err := s.gitService.Commit(absTarget, "chore: init YANTA directory"); err != nil {
		s.rollback(absTarget, currentDataDir)
		return fmt.Errorf("git commit failed: %w", err)
	}

	if remoteURL != "" {
		logger.Infof("setting git remote: %s", remoteURL)
		if err := s.gitService.SetRemote(absTarget, "origin", remoteURL); err != nil {
			logger.Warnf("failed to set remote (non-fatal): %v", err)
		}
	}

	logger.Info("updating configuration")
	if err := config.SetDataDirectory(absTarget); err != nil {
		s.rollback(absTarget, currentDataDir)
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
