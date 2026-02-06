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

// Journal FTS methods

func (s *Store) InsertJournalEntry(ctx context.Context, projectAlias, date, entryID, content string, tags []string) error {
	return s.InsertJournalEntryTx(ctx, s.db, projectAlias, date, entryID, content, tags)
}

func (s *Store) InsertJournalEntryTx(ctx context.Context, q Queryer, projectAlias, date, entryID, content string, tags []string) error {
	if entryID == "" {
		return fmt.Errorf("entryID cannot be empty")
	}

	tagsStr := ""
	if len(tags) > 0 {
		tagsStr = " " + joinTags(tags) + " " // Space-padded for LIKE matching
	}

	query := `
		INSERT INTO fts_journal (content, tags, project_alias, date, entry_id)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := q.ExecContext(ctx, query, content, tagsStr, projectAlias, date, entryID)
	if err != nil {
		return fmt.Errorf("inserting journal entry into fts_journal: %w", err)
	}

	return nil
}

func (s *Store) DeleteJournalEntry(ctx context.Context, projectAlias, date, entryID string) error {
	return s.DeleteJournalEntryTx(ctx, s.db, projectAlias, date, entryID)
}

func (s *Store) DeleteJournalEntryTx(ctx context.Context, q Queryer, projectAlias, date, entryID string) error {
	if entryID == "" {
		return fmt.Errorf("entryID cannot be empty")
	}

	query := `DELETE FROM fts_journal WHERE project_alias = ? AND date = ? AND entry_id = ?`

	result, err := q.ExecContext(ctx, query, projectAlias, date, entryID)
	if err != nil {
		return fmt.Errorf("deleting journal entry from fts_journal: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("journal entry not found in fts_journal: %s/%s/%s", projectAlias, date, entryID)
	}

	return nil
}

func (s *Store) UpdateJournalEntry(ctx context.Context, projectAlias, date, entryID, content string, tags []string) error {
	return s.UpdateJournalEntryTx(ctx, s.db, projectAlias, date, entryID, content, tags)
}

func (s *Store) UpdateJournalEntryTx(ctx context.Context, q Queryer, projectAlias, date, entryID, content string, tags []string) error {
	// Delete + insert pattern (FTS5 doesn't support UPDATE well)
	_ = s.DeleteJournalEntryTx(ctx, q, projectAlias, date, entryID)
	return s.InsertJournalEntryTx(ctx, q, projectAlias, date, entryID, content, tags)
}

func (s *Store) DeleteAllJournalEntries(ctx context.Context) error {
	return s.DeleteAllJournalEntriesTx(ctx, s.db)
}

func (s *Store) DeleteAllJournalEntriesTx(ctx context.Context, q Queryer) error {
	query := `DELETE FROM fts_journal`

	_, err := q.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("deleting all journal entries from fts_journal: %w", err)
	}

	return nil
}

// SearchJournalEntries searches the fts_journal table and returns matching entries.
func (s *Store) SearchJournalEntries(ctx context.Context, fts5Query string) ([]JournalSearchResult, error) {
	return s.SearchJournalEntriesTx(ctx, s.db, fts5Query)
}

// JournalSearchResult represents a single journal search result from fts_journal.
type JournalSearchResult struct {
	ProjectAlias string
	Date         string
	EntryID      string
	Content      string
	Tags         string
	Rank         float64
	Snippet      string
}

func (s *Store) SearchJournalEntriesTx(ctx context.Context, q Queryer, fts5Query string) ([]JournalSearchResult, error) {
	if fts5Query == "" {
		return nil, fmt.Errorf("query cannot be empty")
	}

	query := `
		SELECT project_alias, date, entry_id, content, tags, bm25(fts_journal) AS rank,
		       snippet(fts_journal, 0, '<mark>', '</mark>', ' … ', 30) AS snippet
		FROM fts_journal
		WHERE fts_journal MATCH ?
		ORDER BY rank
	`

	rows, err := q.QueryContext(ctx, query, fts5Query)
	if err != nil {
		return nil, fmt.Errorf("searching fts_journal: %w", err)
	}
	defer rows.Close()

	var results []JournalSearchResult

	for rows.Next() {
		var r JournalSearchResult
		if err := rows.Scan(&r.ProjectAlias, &r.Date, &r.EntryID, &r.Content, &r.Tags, &r.Rank, &r.Snippet); err != nil {
			return nil, fmt.Errorf("scanning journal search result: %w", err)
		}
		results = append(results, r)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating journal search rows: %w", err)
	}

	return results, nil
}

// joinTags joins tags with spaces for FTS indexing.
func joinTags(tags []string) string {
	result := ""
	for i, tag := range tags {
		if i > 0 {
			result += " "
		}
		result += tag
	}
	return result
}
