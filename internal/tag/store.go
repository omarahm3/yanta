package tag

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type queryExecer interface {
	queryer
	execer
}

type Store struct {
	db *sql.DB
}

type GetFilters struct {
	NameLike       *string
	IncludeDeleted bool
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Create(ctx context.Context, t *Tag) (*Tag, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	t, err = s.create(ctx, tx, t)
	if err != nil {
		return nil, fmt.Errorf("creating tag: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return t, nil
}

func (s *Store) CreateTx(ctx context.Context, tx *sql.Tx, t *Tag) (*Tag, error) {
	return s.create(ctx, tx, t)
}

func (s *Store) GetByName(ctx context.Context, name string) (*Tag, error) {
	return s.getByName(ctx, s.db, name)
}

func (s *Store) GetByNameTx(ctx context.Context, tx *sql.Tx, name string) (*Tag, error) {
	return s.getByName(ctx, tx, name)
}

func (s *Store) Get(ctx context.Context, filters *GetFilters) ([]*Tag, error) {
	return s.get(ctx, s.db, filters)
}

func (s *Store) GetTx(ctx context.Context, tx *sql.Tx, filters *GetFilters) ([]*Tag, error) {
	return s.get(ctx, tx, filters)
}

func (s *Store) GetByDocumentPath(ctx context.Context, documentPath string) ([]*Tag, error) {
	return s.getByDocumentPath(ctx, s.db, documentPath)
}

func (s *Store) GetByDocumentPathTx(ctx context.Context, tx *sql.Tx, documentPath string) ([]*Tag, error) {
	return s.getByDocumentPath(ctx, tx, documentPath)
}

func (s *Store) SoftDelete(ctx context.Context, name string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.softDelete(ctx, tx, name); err != nil {
		return fmt.Errorf("soft deleting tag: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) SoftDeleteTx(ctx context.Context, tx *sql.Tx, name string) error {
	return s.softDelete(ctx, tx, name)
}

func (s *Store) Restore(ctx context.Context, name string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.restore(ctx, tx, name); err != nil {
		return fmt.Errorf("restoring tag: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RestoreTx(ctx context.Context, tx *sql.Tx, name string) error {
	return s.restore(ctx, tx, name)
}

func (s *Store) HardDelete(ctx context.Context, name string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.hardDelete(ctx, tx, name); err != nil {
		return fmt.Errorf("hard deleting tag: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) HardDeleteTx(ctx context.Context, tx *sql.Tx, name string) error {
	return s.hardDelete(ctx, tx, name)
}

func (s *Store) create(ctx context.Context, qe queryExecer, t *Tag) (*Tag, error) {
	if t == nil {
		return nil, fmt.Errorf("tag is required")
	}

	query := `
		INSERT INTO tag (name)
		VALUES (lower(?))
		RETURNING name, created_at, updated_at;
	`

	err := qe.QueryRowContext(ctx, query, t.Name).Scan(&t.Name, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}

	return t, nil
}

func (s *Store) getByName(ctx context.Context, q queryer, name string) (*Tag, error) {
	t := new(Tag)

	query := `
		SELECT name, created_at, updated_at, COALESCE(deleted_at, '')
		FROM tag
		WHERE name = lower(?) AND deleted_at IS NULL;
	`

	err := q.QueryRowContext(ctx, query, name).Scan(
		&t.Name,
		&t.CreatedAt,
		&t.UpdatedAt,
		&t.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get tag: %w", err)
	}

	return t, nil
}

func (s *Store) get(ctx context.Context, q queryer, filters *GetFilters) ([]*Tag, error) {
	conditions := []string{}
	args := []any{}

	if !filters.IncludeDeleted {
		conditions = append(conditions, "deleted_at IS NULL")
	}

	if filters.NameLike != nil {
		conditions = append(conditions, "name LIKE ?")
		args = append(args, "%"+strings.ToLower(*filters.NameLike)+"%")
	}

	query := `
		SELECT name, created_at, updated_at, COALESCE(deleted_at, '')
		FROM tag
	`

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY name ASC"

	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	tags := make([]*Tag, 0)
	for rows.Next() {
		t := new(Tag)
		err := rows.Scan(
			&t.Name,
			&t.CreatedAt,
			&t.UpdatedAt,
			&t.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tag row: %w", err)
		}
		tags = append(tags, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag rows: %w", err)
	}

	return tags, nil
}

func (s *Store) getByDocumentPath(ctx context.Context, q queryer, documentPath string) ([]*Tag, error) {
	query := `
		SELECT t.name, t.created_at, t.updated_at, COALESCE(t.deleted_at, '')
		FROM tag t
		JOIN doc_tag dt ON t.name = dt.tag
		WHERE dt.path = ? AND t.deleted_at IS NULL;
	`

	rows, err := q.QueryContext(ctx, query, documentPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}
	defer rows.Close()

	tags := make([]*Tag, 0)
	for rows.Next() {
		t := new(Tag)
		err := rows.Scan(&t.Name, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tag row: %w", err)
		}
		tags = append(tags, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag rows: %w", err)
	}

	return tags, nil
}

func (s *Store) softDelete(ctx context.Context, qe queryExecer, name string) error {
	query := `
		UPDATE tag
		SET deleted_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE name = lower(?) AND deleted_at IS NULL;
	`

	result, err := qe.ExecContext(ctx, query, name)
	if err != nil {
		return fmt.Errorf("failed to soft delete tag: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("tag not found or already deleted: %s", name)
	}

	return nil
}

func (s *Store) restore(ctx context.Context, qe queryExecer, name string) error {
	query := `
		UPDATE tag
		SET deleted_at = NULL
		WHERE name = lower(?) AND deleted_at IS NOT NULL;
	`

	result, err := qe.ExecContext(ctx, query, name)
	if err != nil {
		return fmt.Errorf("failed to restore tag: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("tag not found or not deleted: %s", name)
	}

	return nil
}

func (s *Store) hardDelete(ctx context.Context, qe queryExecer, name string) error {
	query := `
		DELETE FROM tag
		WHERE name = lower(?);
	`

	result, err := qe.ExecContext(ctx, query, name)
	if err != nil {
		return fmt.Errorf("failed to hard delete tag: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("tag not found: %s", name)
	}

	return nil
}
