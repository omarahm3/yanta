package app

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"yanta/internal/blocknote"
	"yanta/internal/document"
	"yanta/internal/journal"
	"yanta/internal/mcp"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/tag"
)

// mcpVault adapts Yanta's concrete services to the mcp.Vault interface. It is
// the single place where MCP tool calls enter the in-process service layer, and
// where Markdown is converted to and from the BlockNote block model. Because it
// reuses the exact service instances the GUI uses, the FTS index, project
// cache, event bus, and git-sync all stay coherent.
type mcpVault struct {
	documents    *document.Service
	search       *search.Service
	projects     *project.Service
	projectCache *project.Cache
	journal      *journal.Service
	tags         *tag.Service
}

var _ mcp.Vault = (*mcpVault)(nil)

// --- read ---

func (m *mcpVault) SearchNotes(ctx context.Context, query string, limit, offset int) ([]mcp.SearchHit, error) {
	results, err := m.search.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	hits := make([]mcp.SearchHit, 0, len(results))
	for _, r := range results {
		hits = append(hits, mcp.SearchHit{
			ID:           r.ID,
			Type:         r.Type,
			Title:        r.Title,
			Snippet:      r.Snippet,
			ProjectAlias: r.ProjectAlias,
			Updated:      r.Updated,
		})
	}
	return hits, nil
}

func (m *mcpVault) ListProjects(ctx context.Context, includeArchived bool) ([]mcp.ProjectInfo, error) {
	active, err := m.projects.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]mcp.ProjectInfo, 0, len(active))
	for _, p := range active {
		out = append(out, mcp.ProjectInfo{ID: p.ID, Name: p.Name, Alias: p.Alias, Archived: false})
	}
	if includeArchived {
		archived, err := m.projects.ListArchived(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range archived {
			out = append(out, mcp.ProjectInfo{ID: p.ID, Name: p.Name, Alias: p.Alias, Archived: true})
		}
	}
	return out, nil
}

func (m *mcpVault) ListDocuments(ctx context.Context, alias string, includeArchived bool, limit, offset int) ([]mcp.DocumentInfo, error) {
	docs, err := m.documents.ListByProject(ctx, alias, includeArchived, limit, offset)
	if err != nil {
		return nil, err
	}
	out := make([]mcp.DocumentInfo, 0, len(docs))
	for _, d := range docs {
		out = append(out, mcp.DocumentInfo{
			Path:         d.Path,
			Title:        d.Title,
			ProjectAlias: d.ProjectAlias,
			Tags:         d.Tags,
			Updated:      d.UpdatedAt,
		})
	}
	return out, nil
}

func (m *mcpVault) GetDocument(ctx context.Context, path string) (mcp.DocumentContent, error) {
	doc, err := m.documents.Get(ctx, path)
	if err != nil {
		return mcp.DocumentContent{}, err
	}
	var md string
	if doc.File != nil {
		md, err = docBlocksToMarkdown(doc.File.Blocks)
		if err != nil {
			return mcp.DocumentContent{}, err
		}
	}
	return mcp.DocumentContent{
		Path:         doc.Path,
		Title:        doc.Title,
		ProjectAlias: doc.ProjectAlias,
		Tags:         doc.Tags,
		Markdown:     md,
	}, nil
}

func (m *mcpVault) ReadJournal(ctx context.Context, alias, date string) ([]mcp.JournalEntryInfo, error) {
	var jf *journal.JournalFile
	var err error
	if date == "" {
		jf, err = m.journal.GetToday(ctx, alias)
	} else {
		jf, err = m.journal.GetByDate(ctx, alias, date)
	}
	if err != nil {
		return nil, err
	}
	out := make([]mcp.JournalEntryInfo, 0, len(jf.Entries))
	for i := range jf.Entries {
		if jf.Entries[i].Deleted {
			continue
		}
		out = append(out, journalEntryInfo(&jf.Entries[i]))
	}
	return out, nil
}

func (m *mcpVault) ListJournalDates(ctx context.Context, alias string) ([]string, error) {
	if alias == "" {
		return m.journal.ListAllDates(ctx)
	}
	return m.journal.ListDates(ctx, alias, 0, 0)
}

func (m *mcpVault) ListTags(ctx context.Context) ([]string, error) {
	tags, err := m.tags.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(tags))
	for _, t := range tags {
		names = append(names, t.Name)
	}
	return names, nil
}

// --- write ---

func (m *mcpVault) CreateDocument(ctx context.Context, alias, title, markdown string, tags []string) (string, error) {
	// document.Service.Save does not verify the project exists, so guard here.
	if _, err := m.projectCache.GetByAlias(ctx, alias); err != nil {
		return "", fmt.Errorf("project %q not found: %w", alias, err)
	}
	blocks, err := markdownToDocBlocks(markdown)
	if err != nil {
		return "", err
	}
	return m.documents.Save(ctx, document.SaveRequest{
		Path:         "",
		ProjectAlias: alias,
		Title:        title,
		Blocks:       blocks,
		Tags:         tags,
	})
}

func (m *mcpVault) UpdateDocument(ctx context.Context, path string, title, markdown *string, tags *[]string) error {
	doc, err := m.documents.Get(ctx, path)
	if err != nil {
		return err
	}
	req := document.SaveRequest{
		Path:         path,
		ProjectAlias: doc.ProjectAlias,
		Title:        doc.Title,
		Tags:         doc.Tags,
	}
	if doc.File != nil {
		req.Blocks = doc.File.Blocks
	}
	if title != nil {
		req.Title = *title
	}
	if tags != nil {
		req.Tags = *tags
	}
	if markdown != nil {
		blocks, err := markdownToDocBlocks(*markdown)
		if err != nil {
			return err
		}
		req.Blocks = blocks
	}
	if req.Blocks == nil {
		req.Blocks = []document.BlockNoteBlock{}
	}
	_, err = m.documents.Save(ctx, req)
	return err
}

func (m *mcpVault) MoveDocument(ctx context.Context, path, targetProject string) error {
	return m.documents.MoveToProject(ctx, path, targetProject)
}

func (m *mcpVault) DeleteDocument(ctx context.Context, path string, hard bool) error {
	if hard {
		return m.documents.HardDelete(ctx, path)
	}
	return m.documents.SoftDelete(ctx, path)
}

func (m *mcpVault) AppendJournal(ctx context.Context, alias, content string, tags []string, date string) (mcp.JournalEntryInfo, error) {
	var entry *journal.JournalEntry
	var err error
	if date == "" {
		entry, err = m.journal.AppendEntry(ctx, journal.AppendEntryRequest{
			ProjectAlias: alias, Content: content, Tags: tags,
		})
	} else {
		entry, err = m.journal.AppendEntryToDate(ctx, journal.AppendEntryRequestWithDate{
			ProjectAlias: alias, Content: content, Tags: tags, Date: date,
		})
	}
	if err != nil {
		return mcp.JournalEntryInfo{}, err
	}
	return journalEntryInfo(entry), nil
}

func (m *mcpVault) AddTagsToDocument(ctx context.Context, path string, tags []string) error {
	return m.tags.AddTagsToDocument(ctx, path, tags)
}

func (m *mcpVault) RemoveTagsFromDocument(ctx context.Context, path string, tags []string) error {
	return m.tags.RemoveTagsFromDocument(ctx, path, tags)
}

// --- helpers ---

func journalEntryInfo(e *journal.JournalEntry) mcp.JournalEntryInfo {
	return mcp.JournalEntryInfo{
		ID:      e.ID,
		Content: e.Content,
		Tags:    e.Tags,
		Created: e.Created.Format(time.RFC3339),
	}
}

// markdownToDocBlocks converts Markdown to document.BlockNoteBlock via the
// blocknote codec. The two block types share an identical JSON shape, so the
// bridge is a single marshal/unmarshal round-trip.
func markdownToDocBlocks(md string) ([]document.BlockNoteBlock, error) {
	raw, err := json.Marshal(blocknote.MarkdownToBlocks(md))
	if err != nil {
		return nil, err
	}
	var blocks []document.BlockNoteBlock
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return nil, err
	}
	if blocks == nil {
		blocks = []document.BlockNoteBlock{}
	}
	return blocks, nil
}

func docBlocksToMarkdown(blocks []document.BlockNoteBlock) (string, error) {
	raw, err := json.Marshal(blocks)
	if err != nil {
		return "", err
	}
	var bb []blocknote.Block
	if err := json.Unmarshal(raw, &bb); err != nil {
		return "", err
	}
	return blocknote.BlocksToMarkdown(bb), nil
}
