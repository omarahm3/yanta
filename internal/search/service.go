// Package search provides full-text search functionality for documents.
package search

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"yanta/internal/events"
	"yanta/internal/logger"
)

type Service struct {
	db       *sql.DB
	eventBus *events.EventBus
}

func NewService(db *sql.DB, eventBus *events.EventBus) *Service {
	return &Service{
		db:       db,
		eventBus: eventBus,
	}
}

func (s *Service) emitEvent(eventName string, payload any) {
	if s.eventBus != nil {
		s.eventBus.Emit(eventName, payload)
	}
}

type Result struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Snippet      string `json:"snippet"`
	Updated      string `json:"updated"`
	Type         string `json:"type"`                   // "document" or "note"
	ProjectAlias string `json:"projectAlias"`           // filled for both
	NoteID       string `json:"noteId,omitempty"`       // only for notes (entry ID within journal file)
	rank         float64                                // internal use for sorting
}

func (s *Service) Query(ctx context.Context, q string, limit, offset int) ([]Result, error) {
	logger.WithFields(logrus.Fields{
		"query":  q,
		"limit":  limit,
		"offset": offset,
	}).Debug("executing search query")

	startTime := time.Now()

	query, err := Parse(q)
	if err != nil {
		logger.WithError(err).WithField("query", q).Error("failed to parse search query")
		return nil, fmt.Errorf("parsing search query: %w", err)
	}

	projectAliases, tags := query.ExtractFilters()
	logger.WithFields(logrus.Fields{
		"projectAliases": projectAliases,
		"tags":           tags,
	}).Debug("extracted filters from query")

	match := query.ToFTS5()
	logger.WithField("fts5Match", match).Debug("converted query to FTS5")

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	hasFTSTerms := match != "" && match != `"*"`
	hasFilters := len(projectAliases) > 0 || len(tags) > 0

	if !hasFTSTerms && !hasFilters {
		logger.Debug("no search terms and no valid filters, returning empty results")
		return []Result{}, nil
	}

	// Search documents
	docResults, err := s.searchDocuments(ctx, match, projectAliases, tags, hasFTSTerms)
	if err != nil {
		return nil, err
	}

	// Search journals (only if we have FTS terms - filter-only search not supported for journals)
	var journalResults []Result
	if hasFTSTerms {
		// Generate journal-specific FTS5 query (uses content column, not title/body)
		journalMatch := query.ToFTS5Journal()
		if journalMatch != "" && journalMatch != `"*"` {
			journalResults, err = s.searchJournals(ctx, journalMatch, projectAliases, tags)
			if err != nil {
				// Log warning but don't fail the entire search
				logger.WithError(err).Warn("journal search failed, continuing with document results only")
			}
		}
	}

	// Merge results by rank (BM25 score - lower is better)
	allResults := append(docResults, journalResults...)
	sortResultsByRank(allResults)

	// Apply pagination to combined results
	total := len(allResults)
	if offset >= total {
		allResults = []Result{}
	} else {
		end := offset + limit
		if end > total {
			end = total
		}
		allResults = allResults[offset:end]
	}

	duration := time.Since(startTime)

	s.emitEvent(events.SearchPerformed, map[string]any{
		"query":       q,
		"resultCount": len(allResults),
		"duration":    duration.Milliseconds(),
	})

	logger.WithFields(logrus.Fields{
		"query":       q,
		"resultCount": len(allResults),
		"docCount":    len(docResults),
		"noteCount":   len(journalResults),
		"duration":    duration.Milliseconds(),
	}).Info("search completed")

	return allResults, nil
}

// searchDocuments searches the fts_doc table for documents.
func (s *Service) searchDocuments(ctx context.Context, match string, projectAliases, tags []string, hasFTSTerms bool) ([]Result, error) {
	var sqlBuilder string
	var args []any
	var whereClauses []string

	if hasFTSTerms {
		sqlBuilder = `
SELECT d.path, d.title, d.project_alias,
       bm25(fts_doc) AS rank,
       snippet(fts_doc, -1, '<mark>', '</mark>', ' … ', 12) AS snippet,
       d.updated_at
  FROM fts_doc
  JOIN doc d ON d.path = fts_doc.path`
		args = append(args, match)
		whereClauses = []string{"fts_doc MATCH ?", "d.deleted_at IS NULL"}
	} else {
		sqlBuilder = `
SELECT d.path, d.title, d.project_alias,
       0 AS rank,
       '' AS snippet,
       d.updated_at
  FROM doc d`
		whereClauses = []string{"d.deleted_at IS NULL"}
	}

	if len(projectAliases) > 0 {
		placeholders := make([]string, len(projectAliases))
		for i, alias := range projectAliases {
			placeholders[i] = "?"
			args = append(args, alias)
		}
		whereClauses = append(
			whereClauses,
			fmt.Sprintf("d.project_alias IN (%s)", strings.Join(placeholders, ", ")),
		)
	}

	if len(tags) > 0 {
		sqlBuilder += `
  JOIN doc_tag dt ON d.path = dt.path`

		placeholders := make([]string, len(tags))
		for i, tag := range tags {
			placeholders[i] = "?"
			args = append(args, tag)
		}
		whereClauses = append(
			whereClauses,
			fmt.Sprintf("dt.tag IN (%s)", strings.Join(placeholders, ", ")),
		)
	}

	sqlBuilder += `
 WHERE ` + strings.Join(whereClauses, " AND ") + `
 ORDER BY rank ASC, d.updated_at DESC`

	logger.WithFields(logrus.Fields{
		"sql":  sqlBuilder,
		"args": args,
	}).Debug("executing document search SQL")

	rows, err := s.db.QueryContext(ctx, sqlBuilder, args...)
	if err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"match": match,
			"sql":   sqlBuilder,
		}).Error("failed to execute document search query")
		return nil, formatSearchError(err, "")
	}
	defer rows.Close()

	var out []Result
	for rows.Next() {
		var r Result
		var snippet sql.NullString
		if err := rows.Scan(&r.ID, &r.Title, &r.ProjectAlias, &r.rank, &snippet, &r.Updated); err != nil {
			logger.WithError(err).Error("failed to scan document search result")
			return nil, fmt.Errorf("scanning document search result: %w", err)
		}
		if snippet.Valid {
			r.Snippet = snippet.String
		}
		r.Type = "document"
		out = append(out, r)
	}

	if err := rows.Err(); err != nil {
		logger.WithError(err).Error("error iterating document search results")
		return nil, fmt.Errorf("iterating document search results: %w", err)
	}

	return out, nil
}

// searchJournals searches the fts_journal table for journal entries.
func (s *Service) searchJournals(ctx context.Context, match string, projectAliases, tags []string) ([]Result, error) {
	var sqlBuilder string
	var args []any
	var whereClauses []string

	sqlBuilder = `
SELECT project_alias, date, entry_id, content,
       bm25(fts_journal) AS rank,
       snippet(fts_journal, 0, '<mark>', '</mark>', ' … ', 12) AS snippet,
       tags
  FROM fts_journal`
	args = append(args, match)
	whereClauses = []string{"fts_journal MATCH ?"}

	if len(projectAliases) > 0 {
		placeholders := make([]string, len(projectAliases))
		for i, alias := range projectAliases {
			placeholders[i] = "?"
			args = append(args, alias)
		}
		whereClauses = append(
			whereClauses,
			fmt.Sprintf("project_alias IN (%s)", strings.Join(placeholders, ", ")),
		)
	}

	if len(tags) > 0 {
		// Use LIKE for tag filtering on space-separated tags column
		var tagClauses []string
		for _, tag := range tags {
			tagClauses = append(tagClauses, "tags LIKE ?")
			args = append(args, "% "+tag+" %")
		}
		whereClauses = append(whereClauses, "("+strings.Join(tagClauses, " OR ")+")")
	}

	sqlBuilder += `
 WHERE ` + strings.Join(whereClauses, " AND ") + `
 ORDER BY rank ASC, date DESC`

	logger.WithFields(logrus.Fields{
		"sql":  sqlBuilder,
		"args": args,
	}).Debug("executing journal search SQL")

	rows, err := s.db.QueryContext(ctx, sqlBuilder, args...)
	if err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"match": match,
			"sql":   sqlBuilder,
		}).Error("failed to execute journal search query")
		return nil, formatSearchError(err, "")
	}
	defer rows.Close()

	var out []Result
	for rows.Next() {
		var projectAlias, date, entryID, content, tagsStr string
		var rank float64
		var snippet sql.NullString
		if err := rows.Scan(&projectAlias, &date, &entryID, &content, &rank, &snippet, &tagsStr); err != nil {
			logger.WithError(err).Error("failed to scan journal search result")
			return nil, fmt.Errorf("scanning journal search result: %w", err)
		}

		// Create title from first line of content
		title := extractTitle(content)

		r := Result{
			ID:           fmt.Sprintf("journal/%s/%s/%s", projectAlias, date, entryID),
			Title:        title,
			Updated:      date,
			Type:         "note",
			ProjectAlias: projectAlias,
			NoteID:       entryID,
			rank:         rank,
		}
		if snippet.Valid {
			r.Snippet = snippet.String
		}
		out = append(out, r)
	}

	if err := rows.Err(); err != nil {
		logger.WithError(err).Error("error iterating journal search results")
		return nil, fmt.Errorf("iterating journal search results: %w", err)
	}

	return out, nil
}

// extractTitle extracts a title from content (first line, truncated).
func extractTitle(content string) string {
	// Get first line
	firstLine := content
	if idx := strings.Index(content, "\n"); idx != -1 {
		firstLine = content[:idx]
	}
	firstLine = strings.TrimSpace(firstLine)

	// Truncate if too long
	if len(firstLine) > 60 {
		firstLine = firstLine[:57] + "..."
	}

	if firstLine == "" {
		return "(empty)"
	}

	return firstLine
}

// sortResultsByRank sorts results by BM25 rank (lower is better).
func sortResultsByRank(results []Result) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].rank < results[i].rank {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}

// formatSearchError converts technical database errors into user-friendly messages.
func formatSearchError(err error, query string) error {
	errStr := err.Error()

	if strings.Contains(errStr, "fts5: syntax error") {
		return fmt.Errorf(
			"invalid search syntax. Tips: use * only at end of words (e.g., 'kick*'), avoid special characters like . ? + in search terms",
		)
	}

	if strings.Contains(errStr, "SQL logic error") {
		return fmt.Errorf("invalid search query. Try simpler terms or check your syntax")
	}

	return fmt.Errorf("search failed: %w", err)
}
