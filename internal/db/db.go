package db

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"yanta/internal/logger"
	"yanta/internal/paths"

	_ "modernc.org/sqlite"
)

const defaultFile = "yanta.db"

var (
	ErrFailedToOpenDB       = errors.New("failed to open database")
	ErrFailedToApplyPragmas = errors.New("failed to apply pragmas")
)

func DefaultPath() string {
	return paths.GetDatabasePath()
}

func OpenDB(path string) (*sql.DB, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("%w: failed to create directory %s: %v", ErrFailedToOpenDB, dir, err)
	}

	dsn := path

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFailedToOpenDB, err)
	}

	// Connection pool settings for optimal concurrency and performance:
	// - MaxOpenConns=10: allows concurrent reads while preventing connection thrashing
	// - MaxIdleConns=2: keeps connections ready for immediate reuse
	// - ConnMaxLifetime=0: connections can live forever (fine for desktop apps)
	// Note: WAL mode is specifically designed for multiple concurrent readers + one writer
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(0)

	// Don't apply WAL pragma for in-memory databases (causes schema visibility issues)
	useWAL := path != ":memory:"
	if err := ApplyPragmas(db, useWAL); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFailedToApplyPragmas, err)
	}

	return db, nil
}

func CloseDB(db *sql.DB) error {
	if db == nil {
		return nil
	}

	db.Exec("PRAGMA optimize")
	db.Exec("PRAGMA wal_checkpoint(FULL)")

	return db.Close()
}

// IntegrityCheck verifies database integrity and returns any corruption errors.
// This should be called on application startup to detect corruption early.
func IntegrityCheck(db *sql.DB) error {
	var result string
	err := db.QueryRow("PRAGMA integrity_check").Scan(&result)
	if err != nil {
		return fmt.Errorf("integrity check failed to run: %w", err)
	}

	if result != "ok" {
		return fmt.Errorf("database corruption detected: %s", result)
	}

	logger.Debug("database integrity check passed")
	return nil
}

// CleanupLockFiles removes SQLite lock and journal files.
//
// ⚠️  DANGER: This function deletes WAL files that may contain uncommitted data!
// Only call this in these specific scenarios:
//   - After successful CloseDB() (WAL already checkpointed)
//   - During corruption recovery when data loss is acceptable
//   - When absolutely certain the database is not in use
//
// DO NOT call this before opening the database - SQLite needs the WAL
// files to recover uncommitted changes from previous sessions.
func CleanupLockFiles(dbPath string) error {
	dir := filepath.Dir(dbPath)
	logger.Debugf("cleaning up lock files in %s", dir)
	baseName := strings.TrimSuffix(filepath.Base(dbPath), ".db")

	lockFiles := []string{
		baseName + ".db-wal",
		baseName + ".db-shm",
		baseName + ".db-journal",
		baseName + ".db-wal-shm",
	}

	for _, lockFile := range lockFiles {
		fullPath := filepath.Join(dir, lockFile)
		if _, err := os.Stat(fullPath); err == nil {
			logger.Warnf("removing lock file %s (may cause data loss if DB is active)", fullPath)
			os.Remove(fullPath)
		}
	}

	return nil
}

// ForceCleanup is an alias for CleanupLockFiles.
//
// ⚠️  EXTREME DANGER: This forcibly deletes database lock files.
// Only use this when recovering from database corruption and data loss is acceptable.
// NEVER call this during normal operation or before opening the database.
func ForceCleanup(dbPath string) error {
	logger.Warn("ForceCleanup called - this may cause data loss!")
	return CleanupLockFiles(dbPath)
}
