package search

import (
	"context"
	"database/sql"
	"fmt"
)

type Queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) InsertDocument(ctx context.Context, path, title, headings, body, code string) error {
	return s.InsertDocumentTx(ctx, s.db, path, title, headings, body, code)
}

func (s *Store) InsertDocumentTx(ctx context.Context, q Queryer, path, title, headings, body, code string) error {
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}

	query := `
		INSERT INTO fts_doc (title, headings, body, code, path)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := q.ExecContext(ctx, query, title, headings, body, code, path)
	if err != nil {
		return fmt.Errorf("inserting document into fts_doc: %w", err)
	}

	return nil
}

func (s *Store) DeleteDocument(ctx context.Context, path string) error {
	return s.DeleteDocumentTx(ctx, s.db, path)
}

func (s *Store) DeleteDocumentTx(ctx context.Context, q Queryer, path string) error {
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}

	query := `DELETE FROM fts_doc WHERE path = ?`

	result, err := q.ExecContext(ctx, query, path)
	if err != nil {
		return fmt.Errorf("deleting document from fts_doc: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("document not found in fts_doc: %s", path)
	}

	return nil
}

func (s *Store) UpdateDocument(ctx context.Context, path, title, headings, body, code string) error {
	return s.UpdateDocumentTx(ctx, s.db, path, title, headings, body, code)
}

func (s *Store) UpdateDocumentTx(ctx context.Context, q Queryer, path, title, headings, body, code string) error {
	_ = s.DeleteDocumentTx(ctx, q, path)
	return s.InsertDocumentTx(ctx, q, path, title, headings, body, code)
}

func (s *Store) Search(ctx context.Context, fts5Query string) ([]string, error) {
	return s.SearchTx(ctx, s.db, fts5Query)
}

func (s *Store) SearchTx(ctx context.Context, q Queryer, fts5Query string) ([]string, error) {
	if fts5Query == "" {
		return nil, fmt.Errorf("query cannot be empty")
	}

	query := `
		SELECT path FROM fts_doc
		WHERE fts_doc MATCH ?
		ORDER BY rank
	`

	rows, err := q.QueryContext(ctx, query, fts5Query)
	if err != nil {
		return nil, fmt.Errorf("searching fts_doc: %w", err)
	}
	defer rows.Close()

	var paths []string

	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("scanning path: %w", err)
		}
		paths = append(paths, path)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating rows: %w", err)
	}

	return paths, nil
}

func (s *Store) DeleteAll(ctx context.Context) error {
	return s.DeleteAllTx(ctx, s.db)
}

func (s *Store) DeleteAllTx(ctx context.Context, q Queryer) error {
	query := `DELETE FROM fts_doc`

	_, err := q.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("deleting all documents from fts_doc: %w", err)
	}

	return nil
}
