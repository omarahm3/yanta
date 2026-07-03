// Package mcp exposes a Yanta vault to external agents (Claude Code, Codex,
// opencode, ...) over the Model Context Protocol.
//
// It is deliberately decoupled from the concrete Yanta services: all vault
// operations go through the Vault interface, expressed in terms of this
// package's own DTOs and plain Markdown strings. That keeps this package free
// of the internal/document (and therefore Wails/GTK4) build chain, so the tool
// layer builds and unit-tests headlessly. The concrete adapter that calls the
// real services and performs the Markdown<->BlockNote conversion lives at the
// app layer.
package mcp

import "context"

// Vault is the set of operations the MCP tools expose. All content crosses this
// boundary as Markdown; the adapter is responsible for converting to and from
// Yanta's BlockNote block model.
type Vault interface {
	// --- read ---
	SearchNotes(ctx context.Context, query string, limit, offset int) ([]SearchHit, error)
	ListProjects(ctx context.Context, includeArchived bool) ([]ProjectInfo, error)
	ListDocuments(ctx context.Context, projectAlias string, includeArchived bool, limit, offset int) ([]DocumentInfo, error)
	GetDocument(ctx context.Context, path string) (DocumentContent, error)
	ReadJournal(ctx context.Context, projectAlias, date string) ([]JournalEntryInfo, error)
	ListJournalDates(ctx context.Context, projectAlias string) ([]string, error)
	ListTags(ctx context.Context) ([]string, error)

	// --- write ---
	// CreateDocument must validate that projectAlias refers to an existing
	// project before writing (document.Service.Save does not check this).
	CreateDocument(ctx context.Context, projectAlias, title, markdown string, tags []string) (path string, err error)
	// UpdateDocument applies only the non-nil fields.
	UpdateDocument(ctx context.Context, path string, title, markdown *string, tags *[]string) error
	MoveDocument(ctx context.Context, path, targetProject string) error
	DeleteDocument(ctx context.Context, path string, hard bool) error
	AppendJournal(ctx context.Context, projectAlias, content string, tags []string, date string) (JournalEntryInfo, error)
	AddTagsToDocument(ctx context.Context, path string, tags []string) error
	RemoveTagsFromDocument(ctx context.Context, path string, tags []string) error
}

// SearchHit is one full-text search result (a document or a journal note).
type SearchHit struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // "document" | "note"
	Title        string `json:"title"`
	Snippet      string `json:"snippet"`
	ProjectAlias string `json:"project_alias"`
	Updated      string `json:"updated,omitempty"`
}

// ProjectInfo describes a project.
type ProjectInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Alias    string `json:"alias"`
	Archived bool   `json:"archived"`
}

// DocumentInfo is a document listing entry (no body).
type DocumentInfo struct {
	Path         string   `json:"path"`
	Title        string   `json:"title"`
	ProjectAlias string   `json:"project_alias"`
	Tags         []string `json:"tags,omitempty"`
	Updated      string   `json:"updated,omitempty"`
}

// DocumentContent is a document with its body rendered as Markdown.
type DocumentContent struct {
	Path         string   `json:"path"`
	Title        string   `json:"title"`
	ProjectAlias string   `json:"project_alias"`
	Tags         []string `json:"tags,omitempty"`
	Markdown     string   `json:"markdown"`
}

// JournalEntryInfo is one journal entry.
type JournalEntryInfo struct {
	ID      string   `json:"id"`
	Content string   `json:"content"`
	Tags    []string `json:"tags,omitempty"`
	Created string   `json:"created"`
}
