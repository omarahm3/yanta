package indexer

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/git"
	"yanta/internal/link"
	"yanta/internal/search"
	"yanta/internal/tag"
	"yanta/internal/testutil"
	"yanta/internal/vault"
)

func setupTestEnv(t *testing.T) (*sql.DB, *vault.Vault) {
	db := testutil.SetupTestDB(t)

	_, err := db.Exec("INSERT INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')")
	if err != nil {
		t.Fatalf("Failed to insert test project: %v", err)
	}

	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	return db, v
}

func createTestDocument(t *testing.T, v *vault.Vault, projectAlias, title string, tags []string) string {
	docFile := document.NewDocumentFile(projectAlias, title, tags)

	// Add sample blocks with link
	docFile.Blocks = []document.BlockNoteBlock{
		{
			ID:    "block-1",
			Type:  "heading",
			Props: map[string]any{"level": float64(1)},
			Content: []document.BlockNoteContent{
				{Type: "text", Text: title},
			},
		},
		{
			ID:   "block-2",
			Type: "paragraph",
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "This is a test document with some content. "},
				{Type: "link", Text: "GitHub", Href: "https://github.com"},
			},
		},
	}

	// Write to disk
	writer := document.NewFileWriter(v)
	aliasSlug := strings.TrimPrefix(projectAlias, "@")
	filename := fmt.Sprintf("doc-%s-%s.json", aliasSlug, time.Now().Format("20060102-150405"))
	relPath := filepath.Join("projects", projectAlias, filename)
	err := writer.WriteFile(relPath, docFile)
	if err != nil {
		t.Fatalf("Failed to write test document: %v", err)
	}

	return relPath
}

func TestIndexer_IndexDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	// Create stores
	docStore := document.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	// Create indexer
	idx := New(db, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	// Create test document
	docPath := createTestDocument(t, v, "@test-project", "Test Document", []string{"test", "indexer"})

	// Index document
	ctx := context.Background()
	err := idx.IndexDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	// Verify doc table
	doc, err := docStore.GetByPath(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByPath() failed: %v", err)
	}

	if doc.Title != "Test Document" {
		t.Errorf("Title mismatch: got %s, want Test Document", doc.Title)
	}

	if doc.ProjectAlias != "@test-project" {
		t.Errorf("ProjectAlias mismatch: got %s, want @test-project", doc.ProjectAlias)
	}

	if !doc.HasLinks {
		t.Error("Expected HasLinks to be true")
	}

	// Verify fts_doc table
	paths, err := ftsStore.Search(ctx, "Test")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Fatalf("Expected 1 search result, got %d", len(paths))
	}

	if paths[0] != docPath {
		t.Errorf("Path mismatch: got %s, want %s", paths[0], docPath)
	}

	// Verify doc_tag table
	tagObjs, err := tagStore.GetByDocumentPath(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByDocumentPath() failed: %v", err)
	}

	if len(tagObjs) != 2 {
		t.Errorf("Expected 2 tags, got %d", len(tagObjs))
	}

	// Verify doc_link table
	links, err := linkStore.GetDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("GetDocumentLinks() failed: %v", err)
	}

	if len(links) != 1 {
		t.Errorf("Expected 1 link, got %d", len(links))
	}

	if len(links) > 0 && links[0].URL != "https://github.com" {
		t.Errorf("Link URL mismatch: got %s", links[0].URL)
	}
}

func TestIndexer_ReindexDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	// Create and index document
	docPath := createTestDocument(t, v, "@test-project", "Original Title", []string{"tag1"})

	ctx := context.Background()
	err := idx.IndexDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	// Modify document
	reader := document.NewFileReader(v)
	docFile, err := reader.ReadFile(docPath)
	if err != nil {
		t.Fatalf("ReadFile() failed: %v", err)
	}

	docFile.Meta.Title = "Updated Title"
	docFile.Meta.Tags = []string{"tag2"}
	// Also update the heading block content to match the new title
	docFile.Blocks[0].Content[0].Text = "Updated Title"
	docFile.UpdateTimestamp()

	writer := document.NewFileWriter(v)
	err = writer.WriteFile(docPath, docFile)
	if err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	// Reindex
	err = idx.ReindexDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("ReindexDocument() failed: %v", err)
	}

	// Verify updated
	doc, err := docStore.GetByPath(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByPath() failed: %v", err)
	}

	if doc.Title != "Updated Title" {
		t.Errorf("Title not updated: got %s", doc.Title)
	}

	// Verify search updated
	paths, err := ftsStore.Search(ctx, "Updated")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Errorf("Expected 1 result for updated title, got %d", len(paths))
	}

	// Verify old title not found
	paths, err = ftsStore.Search(ctx, "Original")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results for old title, got %d", len(paths))
	}

	// Verify tags updated
	tagObjs, err := tagStore.GetByDocumentPath(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByDocumentPath() failed: %v", err)
	}

	if len(tagObjs) != 1 || tagObjs[0].Name != "tag2" {
		t.Errorf("Tags not updated correctly, got: %v", tagObjs)
	}
}

func TestIndexer_RemoveDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	// Create and index document
	docPath := createTestDocument(t, v, "@test-project", "To Be Removed", []string{"test"})

	ctx := context.Background()
	err := idx.IndexDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	// Remove document from FTS only
	err = idx.RemoveDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("RemoveDocument() failed: %v", err)
	}

	// Verify still exists in doc table
	_, err = docStore.GetByPath(ctx, docPath)
	if err != nil {
		t.Errorf("Document should still exist in doc table after RemoveDocument: %v", err)
	}

	// Verify removed from fts_doc
	paths, err := ftsStore.Search(ctx, "Removed")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 search results after removal, got %d", len(paths))
	}
}

func TestIndexer_RemoveDocumentCompletely(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	// Create and index document
	docPath := createTestDocument(t, v, "@test-project", "To Be Removed", []string{"test"})

	ctx := context.Background()
	err := idx.IndexDocument(ctx, docPath)
	if err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	// Remove document completely
	err = idx.RemoveDocumentCompletely(ctx, docPath)
	if err != nil {
		t.Fatalf("RemoveDocumentCompletely() failed: %v", err)
	}

	// Verify removed from doc table
	_, err = docStore.GetByPath(ctx, docPath)
	if err == nil {
		t.Error("Expected error for missing document, got nil")
	}

	// Verify removed from fts_doc
	paths, err := ftsStore.Search(ctx, "Removed")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 search results after removal, got %d", len(paths))
	}

	// Verify tags removed (via CASCADE)
	tagObjs, err := tagStore.GetByDocumentPath(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByDocumentPath() failed: %v", err)
	}

	if len(tagObjs) != 0 {
		t.Errorf("Expected 0 tags after removal, got %d", len(tagObjs))
	}

	// Verify links removed (via CASCADE)
	links, err := linkStore.GetDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("GetDocumentLinks() failed: %v", err)
	}

	if len(links) != 0 {
		t.Errorf("Expected 0 links after removal, got %d", len(links))
	}
}

func TestIndexer_ClearIndex(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	// Create and index multiple documents
	ctx := context.Background()
	for i := 1; i <= 3; i++ {
		title := "Document " + string(rune('0'+i))
		docPath := createTestDocument(t, v, "@test-project", title, []string{"test"})

		err := idx.IndexDocument(ctx, docPath)
		if err != nil {
			t.Fatalf("IndexDocument() failed: %v", err)
		}
	}

	// Clear index
	err := idx.ClearIndex(ctx)
	if err != nil {
		t.Fatalf("ClearIndex() failed: %v", err)
	}

	// Verify all cleared from fts_doc
	paths, err := ftsStore.Search(ctx, "Document")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results after ClearIndex, got %d", len(paths))
	}

	// Verify all cleared from doc table
	var count int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM doc").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count docs: %v", err)
	}

	if count != 0 {
		t.Errorf("Expected 0 docs after ClearIndex, got %d", count)
	}
}
