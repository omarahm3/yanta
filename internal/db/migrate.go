package db

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"yanta/internal/logger"

	"github.com/pressly/goose/v3"
)

const dialect = "sqlite3"

//go:embed migrations/*.sql
var embedMigrations embed.FS

var (
	ErrFailedToSetDialect    = errors.New("failed to set dialect")
	ErrFailedToRunMigrations = errors.New("failed to run migrations")
)

func RunMigrations(db *sql.DB) error {
	logger.Debugf("running migrations")
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect(dialect); err != nil {
		return fmt.Errorf("%w: %v", ErrFailedToSetDialect, err)
	}

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("%w: %v", ErrFailedToRunMigrations, err)
	}

	logger.Debugf("migrations completed")

	return nil
}

func Rollback(db *sql.DB) error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect(dialect); err != nil {
		return err
	}

	return goose.Down(db, "migrations")
}

func MigrationStatus(db *sql.DB) error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect(dialect); err != nil {
		return err
	}

	return goose.Status(db, "migrations")
}
