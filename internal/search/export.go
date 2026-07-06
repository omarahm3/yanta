package search

import (
	"context"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"

	"yanta/internal/logger"
)

// IndexDoc is a single searchable record exported for the frontend's in-memory
// full-text index. It carries the already-extracted plain text (the same corpus
// the FTS tables match on) for a document or a journal note.
type IndexDoc struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // "document" or "note"
	Title        string `json:"title"`
	Headings     string `json:"headings"`
	Body         string `json:"body"`
	Code         string `json:"code"`
	Tags         string `json:"tags"`
	ProjectAlias string `json:"projectAlias"`
	Updated      string `json:"updated"`
	NoteID       string `json:"noteId,omitempty"`
}

// ExportIndex returns every searchable document and journal note as plain-text
// records so the frontend can build an in-memory full-text search index. It
// reads the already-flattened text straight from the FTS tables (no disk I/O,
// no JSON parsing) — the same corpus Query matches against. Soft-deleted
// documents are excluded.
func (s *Service) ExportIndex(ctx context.Context) ([]IndexDoc, error) {
	docs, err := s.exportDocuments(ctx)
	if err != nil {
		return nil, err
	}
	notes, err := s.exportJournals(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]IndexDoc, 0, len(docs)+len(notes))
	out = append(out, docs...)
	out = append(out, notes...)

	logger.WithFields(logrus.Fields{
		"documents": len(docs),
		"notes":     len(notes),
	}).Info("exported search index")

	return out, nil
}

func (s *Service) exportDocuments(ctx context.Context) ([]IndexDoc, error) {
	const q = `
SELECT f.path, d.title, f.headings, f.body, f.code, d.project_alias, d.updated_at,
       COALESCE((SELECT GROUP_CONCAT(dt.tag, ' ') FROM doc_tag dt WHERE dt.path = d.path), '') AS tags
  FROM fts_doc f
  JOIN doc d ON d.path = f.path
 WHERE d.deleted_at IS NULL`

	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("exporting documents for index: %w", err)
	}
	defer rows.Close()

	var out []IndexDoc
	for rows.Next() {
		var d IndexDoc
		if err := rows.Scan(&d.ID, &d.Title, &d.Headings, &d.Body, &d.Code, &d.ProjectAlias, &d.Updated, &d.Tags); err != nil {
			return nil, fmt.Errorf("scanning document index row: %w", err)
		}
		d.Type = "document"
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating document index rows: %w", err)
	}
	return out, nil
}

func (s *Service) exportJournals(ctx context.Context) ([]IndexDoc, error) {
	const q = `
SELECT project_alias, date, entry_id, content, tags
  FROM fts_journal`

	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("exporting journals for index: %w", err)
	}
	defer rows.Close()

	var out []IndexDoc
	for rows.Next() {
		var projectAlias, date, entryID, content, tags string
		if err := rows.Scan(&projectAlias, &date, &entryID, &content, &tags); err != nil {
			return nil, fmt.Errorf("scanning journal index row: %w", err)
		}
		out = append(out, IndexDoc{
			ID:           fmt.Sprintf("journal/%s/%s/%s", projectAlias, date, entryID),
			Type:         "note",
			Title:        extractTitle(content),
			Body:         content,
			Tags:         strings.TrimSpace(tags),
			ProjectAlias: projectAlias,
			Updated:      date,
			NoteID:       entryID,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating journal index rows: %w", err)
	}
	return out, nil
}
