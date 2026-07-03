package mcp

import (
	"context"
	"fmt"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	defaultSearchLimit = 20
	defaultListLimit   = 50
)

// Server registers Yanta's vault tools on an MCP server and serves them over a
// Streamable HTTP transport.
type Server struct {
	vault Vault
	srv   *mcp.Server
}

// NewServer builds an MCP server exposing the vault. version is reported to
// clients during initialization.
func NewServer(v Vault, version string) *Server {
	s := &Server{vault: v}
	s.srv = mcp.NewServer(&mcp.Implementation{Name: "yanta", Version: version}, nil)
	s.register()
	return s
}

// StreamableHandler returns the raw (unauthenticated) MCP HTTP handler. Callers
// should wrap it with Handler for auth; this is exposed mainly for tests.
func (s *Server) StreamableHandler() http.Handler {
	return mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s.srv }, nil)
}

// Handler returns the MCP HTTP handler wrapped with bearer-token auth and an
// anti-DNS-rebinding origin check. An empty token disables token auth (not
// recommended outside tests).
func (s *Server) Handler(token string) http.Handler {
	return withAuth(s.StreamableHandler(), token)
}

func text(msg string) *mcp.CallToolResult {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: msg}}}
}

func (s *Server) register() {
	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "search_notes",
		Description: "Full-text search across documents and journal notes in the vault. Supports filters like project:<alias>, tag:<name>, in:title, in:body.",
	}, s.handleSearch)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "list_projects",
		Description: "List projects in the vault. Documents and journal entries are organized under projects, referenced by their alias.",
	}, s.handleListProjects)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "list_documents",
		Description: "List documents in a project (metadata only, no body). Use get_document to read a document's contents.",
	}, s.handleListDocuments)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "get_document",
		Description: "Read a single document, returning its body as Markdown.",
	}, s.handleGetDocument)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "read_journal",
		Description: "Read the journal entries for a project on a given day (defaults to today).",
	}, s.handleReadJournal)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "list_journal_dates",
		Description: "List the dates (YYYY-MM-DD) that have journal entries, optionally restricted to one project.",
	}, s.handleListJournalDates)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "list_tags",
		Description: "List all tags defined in the vault.",
	}, s.handleListTags)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "create_document",
		Description: "Create a new document in an existing project. The body is provided as Markdown and converted to Yanta's block format.",
	}, s.handleCreateDocument)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "update_document",
		Description: "Update an existing document. Only the provided fields change; the body, when given, replaces the existing content.",
	}, s.handleUpdateDocument)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "move_document",
		Description: "Move a document to a different project.",
	}, s.handleMoveDocument)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "delete_document",
		Description: "Delete a document. By default this is a recoverable soft-delete; set hard=true to delete permanently.",
	}, s.handleDeleteDocument)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "append_journal",
		Description: "Append a plain-text entry to a project's journal (today by default, or a backdated date).",
	}, s.handleAppendJournal)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "add_tags_to_document",
		Description: "Add one or more tags to a document.",
	}, s.handleAddTags)

	mcp.AddTool(s.srv, &mcp.Tool{
		Name:        "remove_tags_from_document",
		Description: "Remove one or more tags from a document.",
	}, s.handleRemoveTags)
}

// --- read handlers ---

type searchArgs struct {
	Query  string `json:"query" jsonschema:"Full-text query. Supports project:<alias>, tag:<name>, in:title, in:body, quoted phrases, -negation, and prefix* terms."`
	Limit  int    `json:"limit,omitempty" jsonschema:"Maximum number of results (default 20)."`
	Offset int    `json:"offset,omitempty" jsonschema:"Result offset for pagination (default 0)."`
}
type searchResult struct {
	Hits []SearchHit `json:"hits"`
}

func (s *Server) handleSearch(ctx context.Context, _ *mcp.CallToolRequest, a searchArgs) (*mcp.CallToolResult, searchResult, error) {
	if a.Query == "" {
		return nil, searchResult{}, fmt.Errorf("query is required")
	}
	limit := a.Limit
	if limit <= 0 {
		limit = defaultSearchLimit
	}
	hits, err := s.vault.SearchNotes(ctx, a.Query, limit, a.Offset)
	if err != nil {
		return nil, searchResult{}, err
	}
	return text(fmt.Sprintf("Found %d result(s).", len(hits))), searchResult{Hits: hits}, nil
}

type listProjectsArgs struct {
	IncludeArchived bool `json:"include_archived,omitempty" jsonschema:"Include archived projects (default false)."`
}
type listProjectsResult struct {
	Projects []ProjectInfo `json:"projects"`
}

func (s *Server) handleListProjects(ctx context.Context, _ *mcp.CallToolRequest, a listProjectsArgs) (*mcp.CallToolResult, listProjectsResult, error) {
	projects, err := s.vault.ListProjects(ctx, a.IncludeArchived)
	if err != nil {
		return nil, listProjectsResult{}, err
	}
	return text(fmt.Sprintf("%d project(s).", len(projects))), listProjectsResult{Projects: projects}, nil
}

type listDocumentsArgs struct {
	ProjectAlias    string `json:"project_alias" jsonschema:"Project alias, without the leading @ (e.g. 'work')."`
	IncludeArchived bool   `json:"include_archived,omitempty"`
	Limit           int    `json:"limit,omitempty" jsonschema:"Maximum results (default 50)."`
	Offset          int    `json:"offset,omitempty"`
}
type listDocumentsResult struct {
	Documents []DocumentInfo `json:"documents"`
}

func (s *Server) handleListDocuments(ctx context.Context, _ *mcp.CallToolRequest, a listDocumentsArgs) (*mcp.CallToolResult, listDocumentsResult, error) {
	if a.ProjectAlias == "" {
		return nil, listDocumentsResult{}, fmt.Errorf("project_alias is required")
	}
	limit := a.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	docs, err := s.vault.ListDocuments(ctx, a.ProjectAlias, a.IncludeArchived, limit, a.Offset)
	if err != nil {
		return nil, listDocumentsResult{}, err
	}
	return text(fmt.Sprintf("%d document(s).", len(docs))), listDocumentsResult{Documents: docs}, nil
}

type getDocumentArgs struct {
	Path string `json:"path" jsonschema:"Document path as returned by list_documents or search_notes (e.g. 'projects/@work/doc-....json')."`
}

func (s *Server) handleGetDocument(ctx context.Context, _ *mcp.CallToolRequest, a getDocumentArgs) (*mcp.CallToolResult, DocumentContent, error) {
	if a.Path == "" {
		return nil, DocumentContent{}, fmt.Errorf("path is required")
	}
	doc, err := s.vault.GetDocument(ctx, a.Path)
	if err != nil {
		return nil, DocumentContent{}, err
	}
	return text(fmt.Sprintf("%q (%d chars).", doc.Title, len(doc.Markdown))), doc, nil
}

type readJournalArgs struct {
	ProjectAlias string `json:"project_alias"`
	Date         string `json:"date,omitempty" jsonschema:"Day as YYYY-MM-DD. Defaults to today."`
}
type readJournalResult struct {
	Entries []JournalEntryInfo `json:"entries"`
}

func (s *Server) handleReadJournal(ctx context.Context, _ *mcp.CallToolRequest, a readJournalArgs) (*mcp.CallToolResult, readJournalResult, error) {
	if a.ProjectAlias == "" {
		return nil, readJournalResult{}, fmt.Errorf("project_alias is required")
	}
	entries, err := s.vault.ReadJournal(ctx, a.ProjectAlias, a.Date)
	if err != nil {
		return nil, readJournalResult{}, err
	}
	return text(fmt.Sprintf("%d journal entr(ies).", len(entries))), readJournalResult{Entries: entries}, nil
}

type listJournalDatesArgs struct {
	ProjectAlias string `json:"project_alias,omitempty" jsonschema:"Restrict to one project. Empty = all projects."`
}
type listJournalDatesResult struct {
	Dates []string `json:"dates"`
}

func (s *Server) handleListJournalDates(ctx context.Context, _ *mcp.CallToolRequest, a listJournalDatesArgs) (*mcp.CallToolResult, listJournalDatesResult, error) {
	dates, err := s.vault.ListJournalDates(ctx, a.ProjectAlias)
	if err != nil {
		return nil, listJournalDatesResult{}, err
	}
	return text(fmt.Sprintf("%d date(s).", len(dates))), listJournalDatesResult{Dates: dates}, nil
}

type noArgs struct{}
type listTagsResult struct {
	Tags []string `json:"tags"`
}

func (s *Server) handleListTags(ctx context.Context, _ *mcp.CallToolRequest, _ noArgs) (*mcp.CallToolResult, listTagsResult, error) {
	tags, err := s.vault.ListTags(ctx)
	if err != nil {
		return nil, listTagsResult{}, err
	}
	return text(fmt.Sprintf("%d tag(s).", len(tags))), listTagsResult{Tags: tags}, nil
}

// --- write handlers ---

type createDocumentArgs struct {
	ProjectAlias string   `json:"project_alias" jsonschema:"Alias of an existing project (without @)."`
	Title        string   `json:"title" jsonschema:"Document title (1-512 chars, no newlines)."`
	Markdown     string   `json:"markdown,omitempty" jsonschema:"Document body as Markdown."`
	Tags         []string `json:"tags,omitempty"`
}
type documentRef struct {
	Path    string `json:"path"`
	Message string `json:"message,omitempty"`
}

func (s *Server) handleCreateDocument(ctx context.Context, _ *mcp.CallToolRequest, a createDocumentArgs) (*mcp.CallToolResult, documentRef, error) {
	if a.ProjectAlias == "" || a.Title == "" {
		return nil, documentRef{}, fmt.Errorf("project_alias and title are required")
	}
	path, err := s.vault.CreateDocument(ctx, a.ProjectAlias, a.Title, a.Markdown, a.Tags)
	if err != nil {
		return nil, documentRef{}, err
	}
	return text("Created " + path), documentRef{Path: path, Message: "created"}, nil
}

type updateDocumentArgs struct {
	Path     string    `json:"path"`
	Title    *string   `json:"title,omitempty" jsonschema:"New title. Omit to leave unchanged."`
	Markdown *string   `json:"markdown,omitempty" jsonschema:"New body as Markdown, replacing the existing content. Omit to leave unchanged."`
	Tags     *[]string `json:"tags,omitempty" jsonschema:"New complete tag set, replacing the existing tags. Omit to leave unchanged."`
}

func (s *Server) handleUpdateDocument(ctx context.Context, _ *mcp.CallToolRequest, a updateDocumentArgs) (*mcp.CallToolResult, opResult, error) {
	if a.Path == "" {
		return nil, opResult{}, fmt.Errorf("path is required")
	}
	if a.Title == nil && a.Markdown == nil && a.Tags == nil {
		return nil, opResult{}, fmt.Errorf("nothing to update: provide at least one of title, markdown, tags")
	}
	if err := s.vault.UpdateDocument(ctx, a.Path, a.Title, a.Markdown, a.Tags); err != nil {
		return nil, opResult{}, err
	}
	return text("Updated " + a.Path), opResult{OK: true, Message: "updated"}, nil
}

type moveDocumentArgs struct {
	Path          string `json:"path"`
	TargetProject string `json:"target_project" jsonschema:"Alias of the destination project (without @)."`
}

func (s *Server) handleMoveDocument(ctx context.Context, _ *mcp.CallToolRequest, a moveDocumentArgs) (*mcp.CallToolResult, opResult, error) {
	if a.Path == "" || a.TargetProject == "" {
		return nil, opResult{}, fmt.Errorf("path and target_project are required")
	}
	if err := s.vault.MoveDocument(ctx, a.Path, a.TargetProject); err != nil {
		return nil, opResult{}, err
	}
	return text("Moved " + a.Path + " to @" + a.TargetProject), opResult{OK: true, Message: "moved"}, nil
}

type deleteDocumentArgs struct {
	Path string `json:"path"`
	Hard bool   `json:"hard,omitempty" jsonschema:"If true, permanently delete the file and record. If false (default), soft-delete (recoverable)."`
}

func (s *Server) handleDeleteDocument(ctx context.Context, _ *mcp.CallToolRequest, a deleteDocumentArgs) (*mcp.CallToolResult, opResult, error) {
	if a.Path == "" {
		return nil, opResult{}, fmt.Errorf("path is required")
	}
	if err := s.vault.DeleteDocument(ctx, a.Path, a.Hard); err != nil {
		return nil, opResult{}, err
	}
	kind := "soft-deleted"
	if a.Hard {
		kind = "permanently deleted"
	}
	return text(kind + " " + a.Path), opResult{OK: true, Message: kind}, nil
}

type appendJournalArgs struct {
	ProjectAlias string   `json:"project_alias"`
	Content      string   `json:"content" jsonschema:"Entry text (plain text, max 10000 chars)."`
	Tags         []string `json:"tags,omitempty"`
	Date         string   `json:"date,omitempty" jsonschema:"Backdate the entry to YYYY-MM-DD. Defaults to today."`
}

func (s *Server) handleAppendJournal(ctx context.Context, _ *mcp.CallToolRequest, a appendJournalArgs) (*mcp.CallToolResult, JournalEntryInfo, error) {
	if a.ProjectAlias == "" || a.Content == "" {
		return nil, JournalEntryInfo{}, fmt.Errorf("project_alias and content are required")
	}
	entry, err := s.vault.AppendJournal(ctx, a.ProjectAlias, a.Content, a.Tags, a.Date)
	if err != nil {
		return nil, JournalEntryInfo{}, err
	}
	return text("Appended journal entry " + entry.ID), entry, nil
}

type docTagsArgs struct {
	Path string   `json:"path"`
	Tags []string `json:"tags" jsonschema:"Tag names (lowercase alphanumeric, plus _ and -)."`
}

func (s *Server) handleAddTags(ctx context.Context, _ *mcp.CallToolRequest, a docTagsArgs) (*mcp.CallToolResult, opResult, error) {
	if a.Path == "" || len(a.Tags) == 0 {
		return nil, opResult{}, fmt.Errorf("path and at least one tag are required")
	}
	if err := s.vault.AddTagsToDocument(ctx, a.Path, a.Tags); err != nil {
		return nil, opResult{}, err
	}
	return text("Tagged " + a.Path), opResult{OK: true, Message: "tags added"}, nil
}

func (s *Server) handleRemoveTags(ctx context.Context, _ *mcp.CallToolRequest, a docTagsArgs) (*mcp.CallToolResult, opResult, error) {
	if a.Path == "" || len(a.Tags) == 0 {
		return nil, opResult{}, fmt.Errorf("path and at least one tag are required")
	}
	if err := s.vault.RemoveTagsFromDocument(ctx, a.Path, a.Tags); err != nil {
		return nil, opResult{}, err
	}
	return text("Untagged " + a.Path), opResult{OK: true, Message: "tags removed"}, nil
}

type opResult struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
}
