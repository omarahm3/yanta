// Package testutil provides database and other test utilities.
package testutil

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"
	"yanta/internal/db"

	_ "modernc.org/sqlite"
)

// SetupTestDB creates a temporary SQLite database with migrations applied.
// It uses db.OpenDB for consistent configuration (WAL mode, pragmas, etc.).
// The database is automatically cleaned up when the test completes.
//
// Usage:
//
//	func TestMyRepo(t *testing.T) {
//	    database := testutil.SetupTestDB(t)
//	    defer testutil.CleanupTestDB(t, database)
//	    // ... test code
//	}
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Create a temporary file for the test database
	// Replace slashes in test name to avoid path separator issues in subtests
	testName := t.Name()
	testName = fmt.Sprintf("%s-%s", testName[:min(len(testName), 10)], fmt.Sprintf("%d", time.Now().UnixNano()))
	tmpfile, err := os.CreateTemp("", fmt.Sprintf("yanta-test-%s-*.db", testName))
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpfile.Close()
	dbPath := tmpfile.Name()

	// Clean up the temp file and WAL files when the test completes
	t.Cleanup(func() {
		os.Remove(dbPath)
		os.Remove(dbPath + "-wal")
		os.Remove(dbPath + "-shm")
	})

	// Open the database using the standard OpenDB function
	database, err := db.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Run migrations
	if err := db.RunMigrations(database); err != nil {
		database.Close()
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return database
}

// CleanupTestDB closes the test database and performs cleanup.
// Uses db.CloseDB to ensure proper WAL checkpoint and optimization.
//
// Usage:
//
//	func TestMyRepo(t *testing.T) {
//	    database := testutil.SetupTestDB(t)
//	    defer testutil.CleanupTestDB(t, database)
//	    // ... test code
//	}
func CleanupTestDB(t *testing.T, database *sql.DB) {
	t.Helper()
	if err := db.CloseDB(database); err != nil {
		t.Errorf("Failed to close test database: %v", err)
	}
}
