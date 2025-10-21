package link

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

type queryer interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}

func (s *Store) AddLinks(ctx context.Context, docPath string, links []*Link) error {
	if len(links) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.AddLinksTx(ctx, tx, docPath, links); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) AddLinksTx(ctx context.Context, tx *sql.Tx, docPath string, links []*Link) error {
	if len(links) == 0 {
		return nil
	}

	return s.addLinks(ctx, tx, docPath, links)
}

func (s *Store) addLinks(ctx context.Context, q queryer, docPath string, links []*Link) error {
	if len(links) == 0 {
		return nil
	}

	placeholders := make([]string, len(links))
	args := make([]interface{}, 0, len(links)*3)

	for i, link := range links {
		placeholders[i] = "(?, ?, ?)"
		args = append(args, docPath, link.URL, link.Host)
	}

	query := fmt.Sprintf(`
		INSERT INTO doc_link (path, url, host)
		VALUES %s
		ON CONFLICT (path, url) DO NOTHING
	`, strings.Join(placeholders, ", "))

	_, err := q.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("inserting links: %w", err)
	}

	return nil
}

func (s *Store) RemoveLinks(ctx context.Context, docPath string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.RemoveLinksTx(ctx, tx, docPath, urls); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RemoveLinksTx(ctx context.Context, tx *sql.Tx, docPath string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	return s.removeLinks(ctx, tx, docPath, urls)
}

func (s *Store) removeLinks(ctx context.Context, q queryer, docPath string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}

	placeholders := make([]string, len(urls))
	args := make([]interface{}, 0, len(urls)+1)
	args = append(args, docPath)

	for i, url := range urls {
		placeholders[i] = "?"
		args = append(args, url)
	}

	query := fmt.Sprintf(`
		DELETE FROM doc_link
		WHERE path = ? AND url IN (%s)
	`, strings.Join(placeholders, ", "))

	_, err := q.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("removing links: %w", err)
	}

	return nil
}

func (s *Store) RemoveAllDocumentLinks(ctx context.Context, docPath string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.RemoveAllDocumentLinksTx(ctx, tx, docPath); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (s *Store) RemoveAllDocumentLinksTx(ctx context.Context, tx *sql.Tx, docPath string) error {
	return s.removeAllDocumentLinks(ctx, tx, docPath)
}

func (s *Store) removeAllDocumentLinks(ctx context.Context, q queryer, docPath string) error {
	query := `DELETE FROM doc_link WHERE path = ?`

	_, err := q.ExecContext(ctx, query, docPath)
	if err != nil {
		return fmt.Errorf("removing all document links: %w", err)
	}

	return nil
}

type DocumentLink struct {
	DocPath string
	URL     string
	Host    string
}

func (s *Store) GetDocumentLinks(ctx context.Context, docPath string) ([]*Link, error) {
	return s.getDocumentLinks(ctx, s.db, docPath)
}

func (s *Store) GetDocumentLinksTx(ctx context.Context, tx *sql.Tx, docPath string) ([]*Link, error) {
	return s.getDocumentLinks(ctx, tx, docPath)
}

func (s *Store) getDocumentLinks(ctx context.Context, q queryer, docPath string) ([]*Link, error) {
	query := `
		SELECT url, host
		FROM doc_link
		WHERE path = ?
		ORDER BY url
	`

	rows, err := q.QueryContext(ctx, query, docPath)
	if err != nil {
		return nil, fmt.Errorf("querying document links: %w", err)
	}
	defer rows.Close()

	var links []*Link

	for rows.Next() {
		var link Link
		if err := rows.Scan(&link.URL, &link.Host); err != nil {
			return nil, fmt.Errorf("scanning link: %w", err)
		}
		links = append(links, &link)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating links: %w", err)
	}

	return links, nil
}

func (s *Store) GetLinksByHost(ctx context.Context, host string) ([]*DocumentLink, error) {
	return s.getLinksByHost(ctx, s.db, host)
}

func (s *Store) GetLinksByHostTx(ctx context.Context, tx *sql.Tx, host string) ([]*DocumentLink, error) {
	return s.getLinksByHost(ctx, tx, host)
}

func (s *Store) getLinksByHost(ctx context.Context, q queryer, host string) ([]*DocumentLink, error) {
	query := `
		SELECT path, url, host
		FROM doc_link
		WHERE host = ?
		ORDER BY path, url
	`

	rows, err := q.QueryContext(ctx, query, host)
	if err != nil {
		return nil, fmt.Errorf("querying links by host: %w", err)
	}
	defer rows.Close()

	var links []*DocumentLink

	for rows.Next() {
		var link DocumentLink
		if err := rows.Scan(&link.DocPath, &link.URL, &link.Host); err != nil {
			return nil, fmt.Errorf("scanning document link: %w", err)
		}
		links = append(links, &link)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating links: %w", err)
	}

	return links, nil
}

func (s *Store) CountDocumentLinks(ctx context.Context, docPath string) (int, error) {
	return s.countDocumentLinks(ctx, s.db, docPath)
}

func (s *Store) CountDocumentLinksTx(ctx context.Context, tx *sql.Tx, docPath string) (int, error) {
	return s.countDocumentLinks(ctx, tx, docPath)
}

func (s *Store) countDocumentLinks(ctx context.Context, q queryer, docPath string) (int, error) {
	query := `SELECT COUNT(*) FROM doc_link WHERE path = ?`

	var count int
	err := q.QueryRowContext(ctx, query, docPath).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting document links: %w", err)
	}

	return count, nil
}
