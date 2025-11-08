package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"yanta/internal/logger"

	"github.com/google/uuid"
)

func SeedProjects(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM project WHERE deleted_at IS NULL").Scan(&count); err != nil {
		return fmt.Errorf("failed to check project count: %w", err)
	}

	if count > 0 {
		logger.Debug("projects already exist, skipping seed")
		return nil
	}

	logger.Info("seeding demo projects...")

	projects := []struct {
		name      string
		alias     string
		startDate string
	}{
		{"Work", "@work", time.Now().Format("2006-01-02")},
		{"Personal", "@personal", time.Now().Format("2006-01-02")},
		{"Learning", "@learning", time.Now().AddDate(0, 0, -30).Format("2006-01-02")},
	}

	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().Format("2006-01-02 15:04:05.000")

	for _, p := range projects {
		projectID := uuid.New().String()

		_, err := tx.ExecContext(ctx, `
			INSERT INTO project (id, name, alias, start_date, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, projectID, p.name, p.alias, p.startDate, now, now)
		if err != nil {
			return fmt.Errorf("failed to insert project %s: %w", p.name, err)
		}

		logger.Debugf("seeded project: %s (%s)", p.name, p.alias)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit seed transaction: %w", err)
	}

	logger.Info("demo projects seeded successfully")
	return nil
}
