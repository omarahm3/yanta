package project

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
	Alias          *string
	NameLike       *string
	Archived       *bool
	Ongoing        *bool
	IncludeDeleted bool
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Create(ctx context.Context, p *Project) (*Project, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	p, err = s.create(ctx, tx, p)
	if err != nil {
		return nil, fmt.Errorf("creating project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return p, nil
}

func (s *Store) CreateTx(ctx context.Context, tx *sql.Tx, p *Project) (*Project, error) {
	return s.create(ctx, tx, p)
}

func (s *Store) GetByID(ctx context.Context, id string) (*Project, error) {
	return s.getByID(ctx, s.db, id)
}

func (s *Store) GetByIDTx(ctx context.Context, tx *sql.Tx, id string) (*Project, error) {
	return s.getByID(ctx, tx, id)
}

func (s *Store) GetByAlias(ctx context.Context, alias string) (*Project, error) {
	return s.getByAlias(ctx, s.db, alias)
}

func (s *Store) GetByAliasTx(ctx context.Context, tx *sql.Tx, alias string) (*Project, error) {
	return s.getByAlias(ctx, tx, alias)
}

func (s *Store) Get(ctx context.Context, filters *GetFilters) ([]*Project, error) {
	return s.get(ctx, s.db, filters)
}

func (s *Store) GetTx(ctx context.Context, tx *sql.Tx, filters *GetFilters) ([]*Project, error) {
	return s.get(ctx, tx, filters)
}

func (s *Store) Update(ctx context.Context, p *Project) (*Project, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	p, err = s.update(ctx, tx, p)
	if err != nil {
		return nil, fmt.Errorf("updating project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return p, nil
}

func (s *Store) UpdateTx(ctx context.Context, tx *sql.Tx, p *Project) (*Project, error) {
	return s.update(ctx, tx, p)
}

func (s *Store) SoftDelete(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.softDelete(ctx, tx, id); err != nil {
		return fmt.Errorf("soft deleting project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) SoftDeleteTx(ctx context.Context, tx *sql.Tx, id string) error {
	return s.softDelete(ctx, tx, id)
}

func (s *Store) Restore(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.restore(ctx, tx, id); err != nil {
		return fmt.Errorf("restoring project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RestoreTx(ctx context.Context, tx *sql.Tx, id string) error {
	return s.restore(ctx, tx, id)
}

func (s *Store) HardDelete(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.hardDelete(ctx, tx, id); err != nil {
		return fmt.Errorf("hard deleting project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) HardDeleteTx(ctx context.Context, tx *sql.Tx, id string) error {
	return s.hardDelete(ctx, tx, id)
}

func (s *Store) create(ctx context.Context, qe queryExecer, p *Project) (*Project, error) {
	if p == nil {
		return nil, fmt.Errorf("project is required")
	}

	if err := Validate(p); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	query := `
		INSERT INTO project (id, name, alias, start_date, end_date)
		VALUES (lower(hex(randomblob(16))), ?, ?, COALESCE(?, strftime('%Y-%m-%d %H:%M:%f', 'now')), NULLIF(?, ''))
		RETURNING id;
	`

	err := qe.QueryRowContext(ctx, query, p.Name, p.Alias, p.StartDate, p.EndDate).Scan(&p.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	return p, nil
}

func (s *Store) getByID(ctx context.Context, q queryer, id string) (*Project, error) {
	p := new(Project)

	query := `
		SELECT id, name, alias, start_date, COALESCE(end_date, ''), created_at, updated_at
		FROM project
		WHERE id = ? AND deleted_at IS NULL;
	`

	err := q.QueryRowContext(ctx, query, id).Scan(
		&p.ID,
		&p.Name,
		&p.Alias,
		&p.StartDate,
		&p.EndDate,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get project: %w", err)
	}

	return p, nil
}

func (s *Store) getByAlias(ctx context.Context, q queryer, alias string) (*Project, error) {
	p := new(Project)

	query := `
		SELECT id, name, alias, start_date, COALESCE(end_date, ''), created_at, updated_at
		FROM project
		WHERE alias = ? AND deleted_at IS NULL;
	`

	err := q.QueryRowContext(ctx, query, alias).Scan(
		&p.ID,
		&p.Name,
		&p.Alias,
		&p.StartDate,
		&p.EndDate,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get project by alias: %w", err)
	}

	return p, nil
}

func (s *Store) get(ctx context.Context, q queryer, filters *GetFilters) ([]*Project, error) {
	conditions := []string{}
	args := []any{}

	if filters.Archived != nil && *filters.Archived {
		conditions = append(conditions, "deleted_at IS NOT NULL")
	} else if filters.Ongoing != nil && *filters.Ongoing {
		conditions = append(conditions, "deleted_at IS NULL")
	} else if !filters.IncludeDeleted {
		conditions = append(conditions, "deleted_at IS NULL")
	}

	if filters.Alias != nil {
		conditions = append(conditions, "alias = ?")
		args = append(args, *filters.Alias)
	}

	if filters.NameLike != nil {
		conditions = append(conditions, "name LIKE ?")
		args = append(args, "%"+*filters.NameLike+"%")
	}

	query := `
		SELECT id, name, alias, start_date, COALESCE(end_date, ''), created_at, updated_at
		FROM project
	`

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY created_at DESC"

	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query projects: %w", err)
	}
	defer rows.Close()

	projects := make([]*Project, 0)
	for rows.Next() {
		p := new(Project)
		err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Alias,
			&p.StartDate,
			&p.EndDate,
			&p.CreatedAt,
			&p.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan project row: %w", err)
		}
		projects = append(projects, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating project rows: %w", err)
	}

	return projects, nil
}

func (s *Store) update(ctx context.Context, qe queryExecer, p *Project) (*Project, error) {
	if p == nil {
		return nil, fmt.Errorf("project is required")
	}

	if err := Validate(p); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	query := `
		UPDATE project
		SET name = ?, alias = ?, start_date = ?, end_date = NULLIF(?, ''), updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE id = ? AND deleted_at IS NULL
		RETURNING id, name, alias, start_date, COALESCE(end_date, ''), created_at, updated_at;
	`

	updatedProject := &Project{}
	err := qe.QueryRowContext(ctx, query, p.Name, p.Alias, p.StartDate, p.EndDate, p.ID).Scan(
		&updatedProject.ID,
		&updatedProject.Name,
		&updatedProject.Alias,
		&updatedProject.StartDate,
		&updatedProject.EndDate,
		&updatedProject.CreatedAt,
		&updatedProject.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no project found with id %s", p.ID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}

	return updatedProject, nil
}

func (s *Store) softDelete(ctx context.Context, qe queryExecer, id string) error {
	query := `
		UPDATE project
		SET deleted_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE id = ? AND deleted_at IS NULL;
	`

	result, err := qe.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to soft delete project: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("project not found or already deleted: %s", id)
	}

	return nil
}

func (s *Store) restore(ctx context.Context, qe queryExecer, id string) error {
	query := `
		UPDATE project
		SET deleted_at = NULL
		WHERE id = ? AND deleted_at IS NOT NULL;
	`

	result, err := qe.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to restore project: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("project not found or not deleted: %s", id)
	}

	return nil
}

func (s *Store) hardDelete(ctx context.Context, qe queryExecer, id string) error {
	query := `
		DELETE FROM project
		WHERE id = ?;
	`

	result, err := qe.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to hard delete project: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("project not found: %s", id)
	}

	return nil
}
