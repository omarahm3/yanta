package document

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"yanta/internal/project"
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
	ProjectAlias   *string
	TitleLike      *string
	HasCode        *bool
	HasImages      *bool
	HasLinks       *bool
	IncludeDeleted bool
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Create(ctx context.Context, d *Document) (*Document, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	d, err = s.create(ctx, tx, d)
	if err != nil {
		return nil, fmt.Errorf("creating document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return d, nil
}

func (s *Store) CreateTx(ctx context.Context, tx *sql.Tx, d *Document) (*Document, error) {
	return s.create(ctx, tx, d)
}

func (s *Store) GetByPath(ctx context.Context, path string) (*Document, error) {
	return s.getByPath(ctx, s.db, path)
}

func (s *Store) GetByPathTx(ctx context.Context, tx *sql.Tx, path string) (*Document, error) {
	return s.getByPath(ctx, tx, path)
}

func (s *Store) Get(ctx context.Context, filters *GetFilters) ([]*Document, error) {
	return s.get(ctx, s.db, filters)
}

func (s *Store) GetTx(ctx context.Context, tx *sql.Tx, filters *GetFilters) ([]*Document, error) {
	return s.get(ctx, tx, filters)
}

func (s *Store) Update(ctx context.Context, d *Document) (*Document, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	d, err = s.update(ctx, tx, d)
	if err != nil {
		return nil, fmt.Errorf("updating document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return d, nil
}

func (s *Store) UpdateTx(ctx context.Context, tx *sql.Tx, d *Document) (*Document, error) {
	return s.update(ctx, tx, d)
}

func (s *Store) SoftDelete(ctx context.Context, path string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.softDelete(ctx, tx, path); err != nil {
		return fmt.Errorf("soft deleting document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) SoftDeleteTx(ctx context.Context, tx *sql.Tx, path string) error {
	return s.softDelete(ctx, tx, path)
}

func (s *Store) Restore(ctx context.Context, path string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.restore(ctx, tx, path); err != nil {
		return fmt.Errorf("restoring document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RestoreTx(ctx context.Context, tx *sql.Tx, path string) error {
	return s.restore(ctx, tx, path)
}

func (s *Store) HardDelete(ctx context.Context, path string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.hardDelete(ctx, tx, path); err != nil {
		return fmt.Errorf("hard deleting document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) HardDeleteTx(ctx context.Context, tx *sql.Tx, path string) error {
	return s.hardDelete(ctx, tx, path)
}

func (s *Store) SoftDeleteByProject(ctx context.Context, projectAlias string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.softDeleteByProject(ctx, tx, projectAlias); err != nil {
		return fmt.Errorf("soft deleting documents by project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) SoftDeleteByProjectTx(ctx context.Context, tx *sql.Tx, projectAlias string) error {
	return s.softDeleteByProject(ctx, tx, projectAlias)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func intToBool(i int) bool {
	return i == 1
}

func (s *Store) create(ctx context.Context, qe queryExecer, d *Document) (*Document, error) {
	if d == nil {
		return nil, fmt.Errorf("document is required")
	}

	if err := Validate(d); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	query := `
		INSERT INTO doc (path, project_alias, title, mtime_ns, size_bytes, has_code, has_images, has_links)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING created_at, updated_at;
	`

	err := qe.QueryRowContext(ctx, query, d.Path, d.ProjectAlias, d.Title, d.ModificationTime, d.Size, boolToInt(d.HasCode), boolToInt(d.HasImages), boolToInt(d.HasLinks)).Scan(&d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	return d, nil
}

func (s *Store) getByPath(ctx context.Context, q queryer, path string) (*Document, error) {
	d := new(Document)

	query := `
		SELECT path, project_alias, title, mtime_ns, size_bytes, has_code, has_images, has_links, created_at, updated_at, COALESCE(deleted_at, '')
		FROM doc
		WHERE path = ? AND deleted_at IS NULL;
	`

	var hasCodeInt, hasImagesInt, hasLinksInt int
	err := q.QueryRowContext(ctx, query, path).Scan(
		&d.Path,
		&d.ProjectAlias,
		&d.Title,
		&d.ModificationTime,
		&d.Size,
		&hasCodeInt,
		&hasImagesInt,
		&hasLinksInt,
		&d.CreatedAt,
		&d.UpdatedAt,
		&d.DeletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	d.HasCode = intToBool(hasCodeInt)
	d.HasImages = intToBool(hasImagesInt)
	d.HasLinks = intToBool(hasLinksInt)

	return d, nil
}

func (s *Store) get(ctx context.Context, q queryer, filters *GetFilters) ([]*Document, error) {
	conditions := []string{}
	args := []any{}

	if !filters.IncludeDeleted {
		conditions = append(conditions, "deleted_at IS NULL")
	}

	if filters.ProjectAlias != nil {
		conditions = append(conditions, "project_alias = ?")
		args = append(args, *filters.ProjectAlias)
	}

	if filters.TitleLike != nil {
		conditions = append(conditions, "title LIKE ?")
		args = append(args, "%"+*filters.TitleLike+"%")
	}

	if filters.HasCode != nil {
		conditions = append(conditions, "has_code = ?")
		args = append(args, *filters.HasCode)
	}

	if filters.HasImages != nil {
		conditions = append(conditions, "has_images = ?")
		args = append(args, *filters.HasImages)
	}

	if filters.HasLinks != nil {
		conditions = append(conditions, "has_links = ?")
		args = append(args, *filters.HasLinks)
	}

	query := `
		SELECT path, project_alias, title, mtime_ns, size_bytes, has_code, has_images, has_links, created_at, updated_at, COALESCE(deleted_at, '')
		FROM doc
	`

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY created_at DESC"

	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query documents: %w", err)
	}
	defer rows.Close()

	documents := make([]*Document, 0)
	for rows.Next() {
		d := new(Document)
		var hasCodeInt, hasImagesInt, hasLinksInt int
		err := rows.Scan(
			&d.Path,
			&d.ProjectAlias,
			&d.Title,
			&d.ModificationTime,
			&d.Size,
			&hasCodeInt,
			&hasImagesInt,
			&hasLinksInt,
			&d.CreatedAt,
			&d.UpdatedAt,
			&d.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document row: %w", err)
		}

		d.HasCode = intToBool(hasCodeInt)
		d.HasImages = intToBool(hasImagesInt)
		d.HasLinks = intToBool(hasLinksInt)

		documents = append(documents, d)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating document rows: %w", err)
	}

	for _, doc := range documents {
		tags, err := s.getDocumentTags(ctx, q, doc.Path)
		if err != nil {
			return nil, fmt.Errorf("failed to get tags for document %s: %w", doc.Path, err)
		}
		doc.Tags = tags
	}

	return documents, nil
}

func (s *Store) getDocumentTags(ctx context.Context, q queryer, docPath string) ([]string, error) {
	query := `SELECT tag FROM doc_tag WHERE path = ? ORDER BY tag`
	rows, err := q.QueryContext(ctx, query, docPath)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	tags := make([]string, 0)
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag rows: %w", err)
	}

	return tags, nil
}

func (s *Store) update(ctx context.Context, qe queryExecer, d *Document) (*Document, error) {
	if d == nil {
		return nil, fmt.Errorf("document is required")
	}

	if err := Validate(d); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	query := `
		UPDATE doc
		SET project_alias = ?, title = ?, mtime_ns = ?, size_bytes = ?, has_code = ?, has_images = ?, has_links = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE path = ? AND deleted_at IS NULL
		RETURNING path, project_alias, title, mtime_ns, size_bytes, has_code, has_images, has_links, created_at, updated_at, COALESCE(deleted_at, '');
	`

	updatedDocument := &Document{}
	var hasCodeInt, hasImagesInt, hasLinksInt int
	err := qe.QueryRowContext(ctx, query, d.ProjectAlias, d.Title, d.ModificationTime, d.Size, boolToInt(d.HasCode), boolToInt(d.HasImages), boolToInt(d.HasLinks), d.Path).Scan(
		&updatedDocument.Path,
		&updatedDocument.ProjectAlias,
		&updatedDocument.Title,
		&updatedDocument.ModificationTime,
		&updatedDocument.Size,
		&hasCodeInt,
		&hasImagesInt,
		&hasLinksInt,
		&updatedDocument.CreatedAt,
		&updatedDocument.UpdatedAt,
		&updatedDocument.DeletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no document found with path %s", d.Path)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update document: %w", err)
	}

	updatedDocument.HasCode = intToBool(hasCodeInt)
	updatedDocument.HasImages = intToBool(hasImagesInt)
	updatedDocument.HasLinks = intToBool(hasLinksInt)

	return updatedDocument, nil
}

func (s *Store) softDelete(ctx context.Context, qe queryExecer, path string) error {
	query := `
		UPDATE doc
		SET deleted_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE path = ? AND deleted_at IS NULL;
	`

	result, err := qe.ExecContext(ctx, query, path)
	if err != nil {
		return fmt.Errorf("failed to soft delete document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("document not found or already deleted: %s", path)
	}

	return nil
}

func (s *Store) restore(ctx context.Context, qe queryExecer, path string) error {
	query := `
		UPDATE doc
		SET deleted_at = NULL
		WHERE path = ? AND deleted_at IS NOT NULL;
	`

	result, err := qe.ExecContext(ctx, query, path)
	if err != nil {
		return fmt.Errorf("failed to restore document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("document not found or not deleted: %s", path)
	}

	return nil
}

func (s *Store) hardDelete(ctx context.Context, qe queryExecer, path string) error {
	query := `
		DELETE FROM doc
		WHERE path = ?;
	`

	result, err := qe.ExecContext(ctx, query, path)
	if err != nil {
		return fmt.Errorf("failed to hard delete document: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("document not found: %s", path)
	}

	return nil
}

func (s *Store) softDeleteByProject(ctx context.Context, qe queryExecer, projectAlias string) error {
	if err := project.ValidateAlias(projectAlias); err != nil {
		return fmt.Errorf("invalid project alias: %w", err)
	}

	query := `
		UPDATE doc
		SET deleted_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
		WHERE project_alias = ? AND deleted_at IS NULL;
	`

	_, err := qe.ExecContext(ctx, query, projectAlias)
	if err != nil {
		return fmt.Errorf("failed to soft delete documents by project: %w", err)
	}

	return nil
}
