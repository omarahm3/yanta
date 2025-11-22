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
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	Updated string `json:"updated"`
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

	var sqlBuilder string
	var args []any
	var whereClauses []string

	if hasFTSTerms {
		sqlBuilder = `
SELECT d.path, d.title,
       bm25(fts_doc) AS rank,
       snippet(fts_doc, -1, '<mark>', '</mark>', ' … ', 12) AS snippet,
       d.updated_at
  FROM fts_doc
  JOIN doc d ON d.path = fts_doc.path`
		args = append(args, match)
		whereClauses = []string{"fts_doc MATCH ?", "d.deleted_at IS NULL"}
	} else {
		sqlBuilder = `
SELECT d.path, d.title,
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
 ORDER BY rank ASC, d.updated_at DESC
 LIMIT ? OFFSET ?`

	args = append(args, limit, offset)

	logger.WithFields(logrus.Fields{
		"sql":  sqlBuilder,
		"args": args,
	}).Debug("executing search SQL")

	rows, err := s.db.QueryContext(ctx, sqlBuilder, args...)
	if err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"match": match,
			"sql":   sqlBuilder,
		}).Error("failed to execute search query")
		return nil, formatSearchError(err, q)
	}
	defer rows.Close()

	var out []Result
	for rows.Next() {
		var r Result
		var rank float64
		var snippet sql.NullString
		if err := rows.Scan(&r.ID, &r.Title, &rank, &snippet, &r.Updated); err != nil {
			logger.WithError(err).Error("failed to scan search result")
			return nil, fmt.Errorf("scanning search result: %w", err)
		}
		if snippet.Valid {
			r.Snippet = snippet.String
		}
		out = append(out, r)
	}

	if err := rows.Err(); err != nil {
		logger.WithError(err).Error("error iterating search results")
		return nil, fmt.Errorf("iterating search results: %w", err)
	}

	duration := time.Since(startTime)

	s.emitEvent(events.SearchPerformed, map[string]any{
		"query":       q,
		"resultCount": len(out),
		"duration":    duration.Milliseconds(),
	})

	logger.WithFields(logrus.Fields{
		"query":       q,
		"resultCount": len(out),
		"duration":    duration.Milliseconds(),
	}).Info("search completed")

	return out, nil
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
