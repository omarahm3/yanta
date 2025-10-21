package db

import (
	"database/sql"
	"fmt"
)

// ApplyPragmas configures SQLite with production-grade settings.
// All pragma configuration is centralized here for maintainability.
func ApplyPragmas(db *sql.DB, useWAL bool) error {
	pragmas := []string{
		// Data Integrity
		"PRAGMA foreign_keys=ON;", // Enforce referential integrity

		// Performance Optimization
		"PRAGMA temp_store=MEMORY;",   // Store temp tables in RAM for speed
		"PRAGMA page_size=4096;",      // 4KB page size
		"PRAGMA cache_size=-64000;",   // 64MB page cache (negative = KB)
		"PRAGMA mmap_size=268435456;", // 256MB memory-mapped I/O

		// Concurrency & Locking
		"PRAGMA busy_timeout=10000;", // 10s timeout for lock contention
	}

	// Production database configuration (not for in-memory test databases)
	if useWAL {
		pragmas = append(pragmas,
			// WAL Mode Configuration
			"PRAGMA journal_mode=WAL;",            // Write-Ahead Logging for concurrency
			"PRAGMA synchronous=NORMAL;",          // Fast + safe with WAL (not FULL)
			"PRAGMA wal_autocheckpoint=1000;",     // Checkpoint every 1000 pages
			"PRAGMA journal_size_limit=67108864;", // 64MB max WAL size
		)
	}

	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			return fmt.Errorf("%w: %v", ErrFailedToApplyPragmas, err)
		}
	}

	return nil
}
