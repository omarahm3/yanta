package tag

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

func (s *Store) AddTagsToDocument(ctx context.Context, docPath string, tagNames []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.addTagsToDocument(ctx, tx, docPath, tagNames); err != nil {
		return fmt.Errorf("adding tags to document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) AddTagsToDocumentTx(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	return s.addTagsToDocument(ctx, tx, docPath, tagNames)
}

func (s *Store) RemoveTagsFromDocument(ctx context.Context, docPath string, tagNames []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.removeTagsFromDocument(ctx, tx, docPath, tagNames); err != nil {
		return fmt.Errorf("removing tags from document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RemoveTagsFromDocumentTx(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	return s.removeTagsFromDocument(ctx, tx, docPath, tagNames)
}

func (s *Store) ReplaceDocumentTags(ctx context.Context, docPath string, tagNames []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.replaceDocumentTags(ctx, tx, docPath, tagNames); err != nil {
		return fmt.Errorf("replacing document tags: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) ReplaceDocumentTagsTx(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	return s.replaceDocumentTags(ctx, tx, docPath, tagNames)
}

func (s *Store) RemoveAllDocumentTags(ctx context.Context, docPath string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.removeAllDocumentTags(ctx, tx, docPath); err != nil {
		return fmt.Errorf("removing all tags from document: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RemoveAllDocumentTagsTx(ctx context.Context, tx *sql.Tx, docPath string) error {
	return s.removeAllDocumentTags(ctx, tx, docPath)
}

func (s *Store) GetDocumentPaths(ctx context.Context, tagName string) ([]string, error) {
	return s.getDocumentPaths(ctx, s.db, tagName)
}

func (s *Store) GetDocumentPathsTx(ctx context.Context, tx *sql.Tx, tagName string) ([]string, error) {
	return s.getDocumentPaths(ctx, tx, tagName)
}

func (s *Store) GetDocumentTags(ctx context.Context, docPath string) ([]*Tag, error) {
	return s.getDocumentTags(ctx, s.db, docPath)
}

func (s *Store) GetDocumentTagsTx(ctx context.Context, tx *sql.Tx, docPath string) ([]*Tag, error) {
	return s.getDocumentTags(ctx, tx, docPath)
}

func (s *Store) CountDocumentTags(ctx context.Context, docPath string) (int, error) {
	return s.countDocumentTags(ctx, s.db, docPath)
}

func (s *Store) CountDocumentTagsTx(ctx context.Context, tx *sql.Tx, docPath string) (int, error) {
	return s.countDocumentTags(ctx, tx, docPath)
}

func (s *Store) addTagsToDocument(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	if len(tagNames) == 0 {
		return nil
	}

	normalizedTags := normalizeTags(tagNames)

	for _, tagName := range normalizedTags {
		_, err := s.getByName(ctx, tx, tagName)
		if err != nil {
			_, err = s.create(ctx, tx, &Tag{Name: tagName})
			if err != nil {
				return fmt.Errorf("creating tag %s: %w", tagName, err)
			}
		}
	}

	query := `
		INSERT INTO doc_tag (path, tag)
		VALUES (?, lower(?))
		ON CONFLICT (path, tag) DO NOTHING;
	`

	for _, tagName := range normalizedTags {
		if _, err := tx.ExecContext(ctx, query, docPath, tagName); err != nil {
			return fmt.Errorf("inserting doc_tag association: %w", err)
		}
	}

	return nil
}

func (s *Store) removeTagsFromDocument(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	if len(tagNames) == 0 {
		return nil
	}

	normalizedTags := normalizeTags(tagNames)

	placeholders := make([]string, len(normalizedTags))
	args := make([]any, len(normalizedTags)+1)
	args[0] = docPath

	for i, tagName := range normalizedTags {
		placeholders[i] = "?"
		args[i+1] = tagName
	}

	query := fmt.Sprintf(`
		DELETE FROM doc_tag
		WHERE path = ? AND tag IN (%s);
	`, strings.Join(placeholders, ", "))

	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("deleting doc_tag associations: %w", err)
	}

	return nil
}

func (s *Store) replaceDocumentTags(ctx context.Context, tx *sql.Tx, docPath string, tagNames []string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	if err := s.removeAllDocumentTags(ctx, tx, docPath); err != nil {
		return fmt.Errorf("removing existing tags: %w", err)
	}

	if len(tagNames) > 0 {
		if err := s.addTagsToDocument(ctx, tx, docPath, tagNames); err != nil {
			return fmt.Errorf("adding new tags: %w", err)
		}
	}

	return nil
}

func (s *Store) removeAllDocumentTags(ctx context.Context, tx *sql.Tx, docPath string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	query := `DELETE FROM doc_tag WHERE path = ?;`

	if _, err := tx.ExecContext(ctx, query, docPath); err != nil {
		return fmt.Errorf("deleting all doc_tag associations: %w", err)
	}

	return nil
}

func (s *Store) getDocumentPaths(ctx context.Context, q queryer, tagName string) ([]string, error) {
	query := `
		SELECT path
		FROM doc_tag
		WHERE tag = lower(?)
		ORDER BY path ASC;
	`

	rows, err := q.QueryContext(ctx, query, tagName)
	if err != nil {
		return nil, fmt.Errorf("querying document paths: %w", err)
	}
	defer rows.Close()

	paths := make([]string, 0)
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("scanning document path: %w", err)
		}
		paths = append(paths, path)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating document paths: %w", err)
	}

	return paths, nil
}

func (s *Store) getDocumentTags(ctx context.Context, q queryer, docPath string) ([]*Tag, error) {
	query := `
		SELECT t.name, t.created_at, t.updated_at, COALESCE(t.deleted_at, '')
		FROM tag t
		INNER JOIN doc_tag dt ON dt.tag = t.name
		WHERE dt.path = ? AND t.deleted_at IS NULL
		ORDER BY t.name ASC;
	`

	rows, err := q.QueryContext(ctx, query, docPath)
	if err != nil {
		return nil, fmt.Errorf("querying document tags: %w", err)
	}
	defer rows.Close()

	tags := make([]*Tag, 0)
	for rows.Next() {
		tag := &Tag{}
		if err := rows.Scan(&tag.Name, &tag.CreatedAt, &tag.UpdatedAt, &tag.DeletedAt); err != nil {
			return nil, fmt.Errorf("scanning tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tags: %w", err)
	}

	return tags, nil
}

func (s *Store) countDocumentTags(ctx context.Context, q queryer, docPath string) (int, error) {
	query := `SELECT COUNT(*) FROM doc_tag WHERE path = ?;`

	var count int
	if err := q.QueryRowContext(ctx, query, docPath).Scan(&count); err != nil {
		return 0, fmt.Errorf("counting document tags: %w", err)
	}

	return count, nil
}

func normalizeTags(tagNames []string) []string {
	seen := make(map[string]bool)
	normalized := make([]string, 0, len(tagNames))

	for _, name := range tagNames {
		name = strings.ToLower(strings.TrimSpace(name))
		if name == "" {
			continue
		}
		if !seen[name] {
			seen[name] = true
			normalized = append(normalized, name)
		}
	}

	return normalized
}
