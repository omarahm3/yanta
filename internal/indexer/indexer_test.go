package indexer

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yanta/internal/asset"
	internaldb "yanta/internal/db"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/link"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/tag"
	"yanta/internal/testutil"
	"yanta/internal/vault"
)

func mustMarshalContent(content []document.BlockNoteContent) json.RawMessage {
	data, err := json.Marshal(content)
	if err != nil {
		panic(err)
	}
	return data
}

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
			Content: mustMarshalContent([]document.BlockNoteContent{
				{Type: "text", Text: title},
			}),
		},
		{
			ID:   "block-2",
			Type: "paragraph",
			Content: mustMarshalContent([]document.BlockNoteContent{
				{Type: "text", Text: "This is a test document with some content. "},
				{Type: "link", Text: "GitHub", Href: "https://github.com"},
			}),
		},
	}

	// Write to disk
	writer := document.NewFileWriter(v)
	aliasSlug := strings.TrimPrefix(projectAlias, "@")
	// Use nanoseconds to ensure unique filenames even when created rapidly
	filename := fmt.Sprintf("doc-%s-%d.json", aliasSlug, time.Now().UnixNano())
	relPath := filepath.Join("projects", projectAlias, filename)
	err := writer.WriteFile(relPath, docFile)
	if err != nil {
		t.Fatalf("Failed to write test document: %v", err)
	}

	// Return forward slashes for cross-platform consistency (matches vault.RelativePath behavior)
	return filepath.ToSlash(relPath)
}

func TestIndexer_IndexDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	// Create stores
	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	// Create indexer
	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

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

func TestIndexer_ReindexSoftDeletedDoc(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	idx := New(db, v, docStore, project.NewStore(db), search.NewStore(db), tag.NewStore(db),
		link.NewStore(db), asset.NewStore(db), git.NewMockSyncManager(), events.NewEventBus())

	ctx := context.Background()
	docPath := createTestDocument(t, v, "@test-project", "Archived Doc", []string{"test"})
	if err := idx.IndexDocument(ctx, docPath); err != nil {
		t.Fatalf("initial IndexDocument failed: %v", err)
	}

	// Archive it — the row is soft-deleted but the .json stays on disk.
	if err := docStore.SoftDelete(ctx, docPath); err != nil {
		t.Fatalf("SoftDelete failed: %v", err)
	}

	// Reindexing the still-on-disk archived doc must NOT INSERT-conflict (that
	// used to abort a full vault scan), and must NOT resurrect it into the
	// active index.
	if err := idx.IndexDocument(ctx, docPath); err != nil {
		t.Fatalf("reindex of soft-deleted doc should be a no-op, got: %v", err)
	}

	if _, err := docStore.GetByPath(ctx, docPath); err == nil {
		t.Error("archived doc should stay out of the active index after reindex")
	}
	stillThere, err := docStore.GetByPathIncludingDeleted(ctx, docPath)
	if err != nil {
		t.Fatalf("GetByPathIncludingDeleted failed: %v", err)
	}
	if stillThere.DeletedAt == "" {
		t.Error("archived doc should remain soft-deleted after reindex")
	}
}

func TestIndexer_ReindexDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

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
	var content []document.BlockNoteContent
	json.Unmarshal(docFile.Blocks[0].Content, &content)
	content[0].Text = "Updated Title"
	docFile.Blocks[0].Content = mustMarshalContent(content)
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
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

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
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

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
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

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

// TestIndexer_ReindexAfterExternalVaultEdit proves the git-pull scenario:
// a JSON note that appears in the vault on disk without going through the app's
// save path (e.g. pulled in from another machine) becomes searchable after the
// startup reindex (ScanAndIndexVault). This guards G1 reliability & data safety:
// externally added notes must never be silently invisible to search.
func TestIndexer_ReindexAfterExternalVaultEdit(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

	ctx := context.Background()

	// Initial state: index a pre-existing note so the index is "warm", just like
	// an app that has been running before a git pull arrives.
	existingPath := createTestDocument(t, v, "@test-project", "Existing Note", []string{"existing"})
	if _, err := idx.ScanAndIndexVault(ctx); err != nil {
		t.Fatalf("initial ScanAndIndexVault() failed: %v", err)
	}
	if _, err := docStore.GetByPath(ctx, existingPath); err != nil {
		t.Fatalf("existing note not indexed by initial scan: %v", err)
	}

	// Simulate an external vault edit (git pull): write a brand-new note file
	// directly to disk, bypassing the app entirely. The unique token lets us
	// assert search hits this specific note and nothing else.
	const uniqueToken = "Zarvox"
	externalDoc := document.NewDocumentFile("@test-project", uniqueToken+" External Note", []string{"pulled"})
	externalDoc.Blocks = []document.BlockNoteBlock{
		{
			ID:      "block-1",
			Type:    "heading",
			Props:   map[string]any{"level": float64(1)},
			Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: uniqueToken + " External Note"}}),
		},
		{
			ID:      "block-2",
			Type:    "paragraph",
			Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: "Body authored on another machine."}}),
		},
	}
	externalDoc.UpdateTimestamp()

	data, err := externalDoc.ToJSON()
	if err != nil {
		t.Fatalf("failed to marshal external note: %v", err)
	}

	projectPath := v.ProjectPath("@test-project")
	if err := os.MkdirAll(projectPath, 0755); err != nil {
		t.Fatalf("failed to ensure project directory: %v", err)
	}
	externalFilename := "external-pulled-note.json"
	if err := os.WriteFile(filepath.Join(projectPath, externalFilename), data, 0644); err != nil {
		t.Fatalf("failed to write external note to disk: %v", err)
	}
	externalRelPath := filepath.ToSlash(filepath.Join("projects", "@test-project", externalFilename))

	// Before reindex: the externally added note is on disk but invisible to search.
	paths, err := ftsStore.Search(ctx, uniqueToken)
	if err != nil {
		t.Fatalf("Search() before reindex failed: %v", err)
	}
	if len(paths) != 0 {
		t.Fatalf("expected external note to be unsearchable before reindex, got %d hits", len(paths))
	}

	// Reindex after the external edit (the git-pull rebuild path).
	if _, err := idx.ScanAndIndexVault(ctx); err != nil {
		t.Fatalf("ScanAndIndexVault() after external edit failed: %v", err)
	}

	// Acceptance: the externally added note is now searchable, and the hit
	// resolves to exactly that file.
	paths, err = ftsStore.Search(ctx, uniqueToken)
	if err != nil {
		t.Fatalf("Search() after reindex failed: %v", err)
	}
	if len(paths) != 1 {
		t.Fatalf("expected 1 search hit for external note after reindex, got %d", len(paths))
	}
	if paths[0] != externalRelPath {
		t.Errorf("search hit path mismatch: got %s, want %s", paths[0], externalRelPath)
	}

	// And it is a fully indexed document, not just an FTS row.
	doc, err := docStore.GetByPath(ctx, externalRelPath)
	if err != nil {
		t.Fatalf("external note not present in doc table after reindex: %v", err)
	}
	if doc.Title != uniqueToken+" External Note" {
		t.Errorf("external note title mismatch: got %s", doc.Title)
	}

	// The pre-existing note must remain searchable; reindex doesn't drop it.
	if _, err := docStore.GetByPath(ctx, existingPath); err != nil {
		t.Errorf("pre-existing note lost after reindex: %v", err)
	}
}

func TestIndexer_ScanAndIndexVault(t *testing.T) {
	t.Run("indexes existing documents in vault", func(t *testing.T) {
		db, v := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Create multiple documents in vault without indexing them
		docPath1 := createTestDocument(t, v, "@test-project", "Document One", []string{"tag1"})
		docPath2 := createTestDocument(t, v, "@test-project", "Document Two", []string{"tag2"})
		docPath3 := createTestDocument(t, v, "@test-project", "Document Three", []string{"tag3"})

		// Verify documents are NOT in database yet
		_, err := docStore.GetByPath(ctx, docPath1)
		if err == nil {
			t.Fatal("Document should not be in database yet")
		}

		// Run scan and index
		_, err = idx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() failed: %v", err)
		}

		// Verify all documents are now indexed
		doc1, err := docStore.GetByPath(ctx, docPath1)
		if err != nil {
			t.Fatalf("Document 1 not found after scan: %v", err)
		}
		if doc1.Title != "Document One" {
			t.Errorf("Document 1 title mismatch: got %s", doc1.Title)
		}

		doc2, err := docStore.GetByPath(ctx, docPath2)
		if err != nil {
			t.Fatalf("Document 2 not found after scan: %v", err)
		}
		if doc2.Title != "Document Two" {
			t.Errorf("Document 2 title mismatch: got %s", doc2.Title)
		}

		doc3, err := docStore.GetByPath(ctx, docPath3)
		if err != nil {
			t.Fatalf("Document 3 not found after scan: %v", err)
		}
		if doc3.Title != "Document Three" {
			t.Errorf("Document 3 title mismatch: got %s", doc3.Title)
		}

		// Verify documents are searchable
		paths, err := ftsStore.Search(ctx, "Document")
		if err != nil {
			t.Fatalf("Search() failed: %v", err)
		}
		if len(paths) != 3 {
			t.Errorf("Expected 3 search results, got %d", len(paths))
		}

		// Verify tags are indexed
		tags1, err := tagStore.GetByDocumentPath(ctx, docPath1)
		if err != nil {
			t.Fatalf("Failed to get tags for doc1: %v", err)
		}
		if len(tags1) != 1 || tags1[0].Name != "tag1" {
			t.Errorf("Tags not indexed correctly for doc1: %v", tags1)
		}
	})

	t.Run("handles empty vault gracefully", func(t *testing.T) {
		db, _ := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		// Setup fresh vault
		tempDir := t.TempDir()
		emptyVault, err := vault.New(vault.Config{RootPath: tempDir})
		if err != nil {
			t.Fatalf("Failed to create empty vault: %v", err)
		}

		emptyIdx := New(db, emptyVault, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Should not error on empty vault
		_, err = emptyIdx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() should not fail on empty vault: %v", err)
		}
	})

	t.Run("handles missing projects directory gracefully", func(t *testing.T) {
		db, _ := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		// Create vault with no projects directory
		tempDir := t.TempDir()
		newVault, err := vault.New(vault.Config{RootPath: tempDir})
		if err != nil {
			t.Fatalf("Failed to create vault: %v", err)
		}

		// Remove the projects directory that was auto-created
		projectsPath := filepath.Join(tempDir, "projects")
		err = filepath.WalkDir(projectsPath, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if path != projectsPath {
				return nil
			}
			return nil
		})

		newIdx := New(db, newVault, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Should not error on missing projects directory
		_, err = newIdx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() should not fail on missing projects dir: %v", err)
		}
	})

	t.Run("skips non-json files", func(t *testing.T) {
		db, v := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Ensure project directory exists
		projectPath := v.ProjectPath("@test-project")
		err := os.MkdirAll(projectPath, 0755)
		if err != nil {
			t.Fatalf("Failed to create project directory: %v", err)
		}

		// Create a text file in the vault that should be ignored
		txtFile := filepath.Join(projectPath, "readme.txt")
		err = os.WriteFile(txtFile, []byte("This is a readme"), 0644)
		if err != nil {
			t.Fatalf("Failed to create text file: %v", err)
		}

		// Scan should not index the txt file
		_, err = idx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() failed: %v", err)
		}

		// Verify no documents were indexed
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM doc").Scan(&count)
		if err != nil {
			t.Fatalf("Failed to count docs: %v", err)
		}
		if count != 0 {
			t.Errorf("Expected 0 documents indexed (txt file should be skipped), got %d", count)
		}
	})

	t.Run("updates existing documents", func(t *testing.T) {
		db, v := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Create and index a document
		docPath := createTestDocument(t, v, "@test-project", "Original", []string{"old"})
		err := idx.IndexDocument(ctx, docPath)
		if err != nil {
			t.Fatalf("Failed to index document: %v", err)
		}

		// Modify the document on disk
		reader := document.NewFileReader(v)
		docFile, err := reader.ReadFile(docPath)
		if err != nil {
			t.Fatalf("Failed to read document: %v", err)
		}

		docFile.Meta.Title = "Updated"
		docFile.Meta.Tags = []string{"new"}
		var content []document.BlockNoteContent
		json.Unmarshal(docFile.Blocks[0].Content, &content)
		content[0].Text = "Updated"
		docFile.Blocks[0].Content = mustMarshalContent(content)
		docFile.UpdateTimestamp()

		writer := document.NewFileWriter(v)
		err = writer.WriteFile(docPath, docFile)
		if err != nil {
			t.Fatalf("Failed to write document: %v", err)
		}

		// Scan should update the existing document
		_, err = idx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() failed: %v", err)
		}

		// Verify document was updated
		doc, err := docStore.GetByPath(ctx, docPath)
		if err != nil {
			t.Fatalf("Failed to get document: %v", err)
		}
		if doc.Title != "Updated" {
			t.Errorf("Document title not updated: got %s", doc.Title)
		}

		// Verify tags were updated
		tags, err := tagStore.GetByDocumentPath(ctx, docPath)
		if err != nil {
			t.Fatalf("Failed to get tags: %v", err)
		}
		if len(tags) != 1 || tags[0].Name != "new" {
			t.Errorf("Tags not updated correctly: %v", tags)
		}
	})

	t.Run("skips directories without @ prefix", func(t *testing.T) {
		db, v := setupTestEnv(t)
		defer testutil.CleanupTestDB(t, db)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()

		// Create a valid project directory with @ prefix
		validProjectPath := filepath.Join(v.RootPath(), "projects", "@valid-project")
		err := os.MkdirAll(validProjectPath, 0755)
		if err != nil {
			t.Fatalf("Failed to create valid project directory: %v", err)
		}

		// Create an invalid project directory WITHOUT @ prefix
		invalidProjectPath := filepath.Join(v.RootPath(), "projects", "invalid-project")
		err = os.MkdirAll(invalidProjectPath, 0755)
		if err != nil {
			t.Fatalf("Failed to create invalid project directory: %v", err)
		}

		// Create a document in the invalid project by writing directly to filesystem
		// (bypassing document writer validation to test indexer's validation)
		docFile := document.NewDocumentFile("@test-project", "Should Not Be Indexed", []string{})
		docFile.Blocks = []document.BlockNoteBlock{
			{
				ID:      "block-1",
				Type:    "paragraph",
				Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: "This should not be indexed"}}),
			},
		}
		docFile.Meta.Project = "invalid-project" // Override to invalid alias
		docFile.UpdateTimestamp()

		// Write directly to filesystem to bypass writer validation
		invalidDocPath := filepath.Join(invalidProjectPath, "test-doc.json")
		data, err := json.MarshalIndent(docFile, "", "  ")
		if err != nil {
			t.Fatalf("Failed to marshal document: %v", err)
		}
		err = os.WriteFile(invalidDocPath, data, 0644)
		if err != nil {
			t.Fatalf("Failed to write document in invalid project: %v", err)
		}

		invalidRelPath := filepath.Join("projects", "invalid-project", "test-doc.json")

		// Scan the vault
		_, err = idx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() failed: %v", err)
		}

		// Verify the invalid project was NOT created
		_, err = projectStore.GetByAlias(ctx, "invalid-project")
		if err == nil {
			t.Error("Invalid project without @ prefix should not be created in database")
		}

		// Verify the document in invalid project was NOT indexed
		_, err = docStore.GetByPath(ctx, invalidRelPath)
		if err == nil {
			t.Error("Document in invalid project should not be indexed")
		}

		// Verify search doesn't find the document
		paths, err := ftsStore.Search(ctx, "Should Not Be Indexed")
		if err != nil {
			t.Fatalf("Search() failed: %v", err)
		}
		if len(paths) != 0 {
			t.Errorf("Expected 0 search results for document in invalid project, got %d", len(paths))
		}

		// Verify the valid project WITH @ prefix would be created (if it had metadata or docs)
		validProjectMetadata := &vault.ProjectMetadata{
			Alias:     "@valid-project",
			Name:      "Valid Project",
			CreatedAt: time.Now().Format(time.RFC3339),
			UpdatedAt: time.Now().Format(time.RFC3339),
		}
		err = v.WriteProjectMetadata(validProjectMetadata)
		if err != nil {
			t.Fatalf("Failed to write valid project metadata: %v", err)
		}

		// Scan again
		_, err = idx.ScanAndIndexVault(ctx)
		if err != nil {
			t.Fatalf("ScanAndIndexVault() second scan failed: %v", err)
		}

		// Verify the valid project WAS created
		validProject, err := projectStore.GetByAlias(ctx, "@valid-project")
		if err != nil {
			t.Errorf("Valid project with @ prefix should be created: %v", err)
		}
		if validProject != nil && validProject.Name != "Valid Project" {
			t.Errorf("Expected project name 'Valid Project', got %s", validProject.Name)
		}
	})
}

// TestScanAndIndexVault_CorruptFilesSkipped verifies the G1 acceptance criteria:
// a corrupt note file does not prevent the app from starting; it is skipped and
// its path is returned so the caller can surface a warning toast to the user.
func TestScanAndIndexVault_CorruptFilesSkipped(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

	ctx := context.Background()

	// Create one valid and one corrupt document in the same project.
	validPath := createTestDocument(t, v, "@test-project", "Valid Note", []string{})

	if err := v.EnsureProjectDir("@test-project"); err != nil {
		t.Fatalf("EnsureProjectDir: %v", err)
	}
	absProjectDir := v.ProjectPath("@test-project")
	corruptAbsPath := filepath.Join(absProjectDir, "doc-corrupt-file.json")
	if err := os.WriteFile(corruptAbsPath, []byte("{not valid json{{"), 0644); err != nil {
		t.Fatalf("writing corrupt file: %v", err)
	}
	corruptRelPath := "projects/@test-project/doc-corrupt-file.json"

	// Scan must succeed (no error) even with a corrupt file present.
	corruptPaths, err := idx.ScanAndIndexVault(ctx)
	if err != nil {
		t.Fatalf("ScanAndIndexVault() returned error on corrupt file: %v", err)
	}

	// The corrupt file must be reported.
	if len(corruptPaths) != 1 || corruptPaths[0] != corruptRelPath {
		t.Errorf("corruptPaths = %v, want [%s]", corruptPaths, corruptRelPath)
	}

	// The valid document must be indexed.
	if _, err := docStore.GetByPath(ctx, validPath); err != nil {
		t.Errorf("valid document not indexed after scan: %v", err)
	}

	// The corrupt document must NOT be in the index.
	if _, err := docStore.GetByPath(ctx, corruptRelPath); err == nil {
		t.Error("corrupt document should not be indexed")
	}
}

func TestScanAndIndexVault_NonCorruptErrorAbortsScan(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	var dbPath string
	if err := db.QueryRow("SELECT file FROM pragma_database_list WHERE name = 'main'").Scan(&dbPath); err != nil {
		t.Fatalf("query database path: %v", err)
	}

	indexDB, err := internaldb.OpenDB(dbPath)
	if err != nil {
		t.Fatalf("OpenDB() failed: %v", err)
	}

	idx := New(indexDB, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

	createTestDocument(t, v, "@test-project", "Valid Note", []string{})

	if err = indexDB.Close(); err != nil {
		t.Fatalf("Close() failed: %v", err)
	}

	_, err = idx.ScanAndIndexVault(context.Background())
	if err == nil {
		t.Fatal("ScanAndIndexVault() should fail on non-corrupt indexing errors")
	}
	if !strings.Contains(err.Error(), "indexing document") {
		t.Fatalf("ScanAndIndexVault() error = %v, want indexing document context", err)
	}
}

func TestReindexPaths_AddAndModify(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	doc1Path := createTestDocument(t, v, "@test-project", "Doc One", []string{})
	doc2Path := createTestDocument(t, v, "@test-project", "Doc Two", []string{})

	changes := []PathChange{
		{Status: "A", Path: doc1Path},
		{Status: "M", Path: doc2Path},
	}

	corruptPaths, err := idx.ReindexPaths(ctx, changes)
	if err != nil {
		t.Fatalf("ReindexPaths() error = %v", err)
	}
	if len(corruptPaths) != 0 {
		t.Errorf("ReindexPaths() corruptPaths = %v, want empty", corruptPaths)
	}

	if _, err := docStore.GetByPath(ctx, doc1Path); err != nil {
		t.Errorf("doc1 not indexed after add: %v", err)
	}
	if _, err := docStore.GetByPath(ctx, doc2Path); err != nil {
		t.Errorf("doc2 not indexed after modify: %v", err)
	}
}

func TestReindexPaths_Delete(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	docPath := createTestDocument(t, v, "@test-project", "To Delete", []string{})
	if err := idx.IndexDocument(ctx, docPath); err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	changes := []PathChange{{Status: "D", Path: docPath}}
	corruptPaths, err := idx.ReindexPaths(ctx, changes)
	if err != nil {
		t.Fatalf("ReindexPaths() error = %v", err)
	}
	if len(corruptPaths) != 0 {
		t.Errorf("ReindexPaths() corruptPaths = %v, want empty", corruptPaths)
	}

	if _, err := docStore.GetByPath(ctx, docPath); err == nil {
		t.Error("deleted document still in doc store")
	}
}

func TestReindexPaths_Rename(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	oldPath := createTestDocument(t, v, "@test-project", "Renamed Doc", []string{})
	if err := idx.IndexDocument(ctx, oldPath); err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	newPath := "projects/@test-project/doc-renamed.json"
	docFile := document.NewDocumentFile("@test-project", "Renamed Doc", []string{})
	writer := document.NewFileWriter(v)
	if err := writer.WriteFile(newPath, docFile); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	changes := []PathChange{{Status: "R", Path: newPath, OldPath: oldPath}}
	corruptPaths, err := idx.ReindexPaths(ctx, changes)
	if err != nil {
		t.Fatalf("ReindexPaths() error = %v", err)
	}
	if len(corruptPaths) != 0 {
		t.Errorf("ReindexPaths() corruptPaths = %v, want empty", corruptPaths)
	}

	if _, err := docStore.GetByPath(ctx, oldPath); err == nil {
		t.Error("old path still in doc store after rename")
	}
	if _, err := docStore.GetByPath(ctx, newPath); err != nil {
		t.Errorf("new path not indexed after rename: %v", err)
	}
}

func TestReindexPaths_CorruptFileSkipped(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	corruptPath := "projects/@test-project/doc-corrupt.json"
	aliasSlug := "test-project"
	corruptFile := filepath.Join(v.RootPath(), corruptPath)
	if err := os.MkdirAll(filepath.Dir(corruptFile), 0755); err != nil {
		t.Fatalf("MkdirAll() failed: %v", err)
	}
	if err := os.WriteFile(corruptFile, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}
	_ = aliasSlug

	changes := []PathChange{{Status: "A", Path: corruptPath}}
	corruptPaths, err := idx.ReindexPaths(ctx, changes)
	if err != nil {
		t.Fatalf("ReindexPaths() error = %v", err)
	}
	if len(corruptPaths) != 1 || corruptPaths[0] != corruptPath {
		t.Errorf("ReindexPaths() corruptPaths = %v, want [%s]", corruptPaths, corruptPath)
	}
}

func TestReindexPaths_Journal(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	journalDir := filepath.Join(v.RootPath(), "projects", "@test-project", "journal")
	if err := os.MkdirAll(journalDir, 0755); err != nil {
		t.Fatalf("MkdirAll() failed: %v", err)
	}
	journalFile := filepath.Join(journalDir, "2026-01-30.json")
	journalContent := `{"entries":[{"id":"entry-1","content":"Test journal entry","tags":["test"],"deleted":false}]}`
	if err := os.WriteFile(journalFile, []byte(journalContent), 0644); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	journalPath := "projects/@test-project/journal/2026-01-30.json"
	changes := []PathChange{{Status: "A", Path: journalPath}}
	corruptPaths, err := idx.ReindexPaths(ctx, changes)
	if err != nil {
		t.Fatalf("ReindexPaths() error = %v", err)
	}
	if len(corruptPaths) != 0 {
		t.Errorf("ReindexPaths() corruptPaths = %v, want empty", corruptPaths)
	}
}

// A journal file renamed to a new date must clear the old date's FTS entries
// (not leave them orphaned) and index the entry under the new date.
func TestReindexPaths_JournalRename(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())
	ctx := context.Background()

	journalDir := filepath.Join(v.RootPath(), "projects", "@test-project", "journal")
	if err := os.MkdirAll(journalDir, 0755); err != nil {
		t.Fatalf("MkdirAll() failed: %v", err)
	}
	content := `{"entries":[{"id":"entry-1","content":"uniquejournaltoken","tags":["test"],"deleted":false}]}`
	oldFile := filepath.Join(journalDir, "2026-01-30.json")
	if err := os.WriteFile(oldFile, []byte(content), 0644); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	oldPath := "projects/@test-project/journal/2026-01-30.json"
	if _, err := idx.ReindexPaths(ctx, []PathChange{{Status: "A", Path: oldPath}}); err != nil {
		t.Fatalf("initial ReindexPaths() error = %v", err)
	}

	// Rename the journal file from 2026-01-30 to 2026-02-15 on disk.
	newFile := filepath.Join(journalDir, "2026-02-15.json")
	if err := os.Rename(oldFile, newFile); err != nil {
		t.Fatalf("Rename() failed: %v", err)
	}
	newPath := "projects/@test-project/journal/2026-02-15.json"
	if _, err := idx.ReindexPaths(ctx, []PathChange{{Status: "R", Path: newPath, OldPath: oldPath}}); err != nil {
		t.Fatalf("rename ReindexPaths() error = %v", err)
	}

	results, err := ftsStore.SearchJournalEntries(ctx, "uniquejournaltoken")
	if err != nil {
		t.Fatalf("SearchJournalEntries() error = %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("SearchJournalEntries() returned %d results, want 1 (old date should be cleared)", len(results))
	}
	if results[0].Date != "2026-02-15" {
		t.Errorf("journal entry indexed under date %q, want 2026-02-15", results[0].Date)
	}
}

func TestIndexer_CanvasDocument(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

	ctx := context.Background()

	t.Run("indexes canvas document with text elements", func(t *testing.T) {
		projectAlias := "@test-project"
		if err := v.EnsureProjectDir(projectAlias); err != nil {
			t.Fatalf("Failed to create project dir: %v", err)
		}

		scene := map[string]any{
			"elements": []any{
				map[string]any{
					"id":   "text1",
					"type": "text",
					"text": "unique canvas text searchable",
				},
				map[string]any{
					"id":   "rect1",
					"type": "rectangle",
				},
				map[string]any{
					"id":   "text2",
					"type": "text",
					"text": "another searchable phrase",
				},
			},
			"appState": map[string]any{},
		}
		sceneJSON, err := json.Marshal(scene)
		if err != nil {
			t.Fatalf("Failed to marshal scene: %v", err)
		}

		docFile := &document.DocumentFile{
			Meta: document.DocumentMeta{
				Project: projectAlias,
				Title:   "Test Canvas",
				Tags:    []string{"canvas-test"},
				Created: time.Now().Add(-time.Hour),
				Updated: time.Now(),
			},
			Kind:  document.DocumentKindCanvas,
			Scene: sceneJSON,
		}

		relativePath := "projects/@test-project/doc-canvas-test.json"
		writer := document.NewFileWriter(v)
		if err := writer.WriteFile(relativePath, docFile); err != nil {
			t.Fatalf("WriteFile() failed: %v", err)
		}

		if err := idx.IndexDocument(ctx, relativePath); err != nil {
			t.Fatalf("IndexDocument() failed: %v", err)
		}

		doc, err := docStore.GetByPath(ctx, relativePath)
		if err != nil {
			t.Fatalf("GetByPath() failed: %v", err)
		}

		if doc.Kind != document.DocumentKindCanvas {
			t.Errorf("Kind = %q, want %q", doc.Kind, document.DocumentKindCanvas)
		}

		results, err := ftsStore.Search(ctx, "unique")
		if err != nil {
			t.Fatalf("Search() failed: %v", err)
		}

		found := false
		for _, path := range results {
			if path == relativePath {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Canvas document not found in search results for 'unique'")
		}

		results2, err := ftsStore.Search(ctx, "searchable")
		if err != nil {
			t.Fatalf("Search() failed: %v", err)
		}

		found2 := false
		for _, path := range results2 {
			if path == relativePath {
				found2 = true
				break
			}
		}
		if !found2 {
			t.Errorf("Canvas document not found in search results for 'searchable'")
		}
	})

	t.Run("canvas document appears in list queries", func(t *testing.T) {
		docs, err := docStore.Get(ctx, &document.GetFilters{
			ProjectAlias:   strPtr("@test-project"),
			IncludeDeleted: false,
		})
		if err != nil {
			t.Fatalf("Get() failed: %v", err)
		}

		canvasCount := 0
		for _, doc := range docs {
			if doc.Kind == document.DocumentKindCanvas {
				canvasCount++
			}
		}

		if canvasCount == 0 {
			t.Error("No canvas documents found in list query")
		}
	})

	t.Run("reindex updates canvas content", func(t *testing.T) {
		relativePath := "projects/@test-project/doc-canvas-test.json"

		scene := map[string]any{
			"elements": []any{
				map[string]any{
					"id":   "text1",
					"type": "text",
					"text": "updated unique canvas content xyz123",
				},
			},
			"appState": map[string]any{},
		}
		sceneJSON, err := json.Marshal(scene)
		if err != nil {
			t.Fatalf("Failed to marshal scene: %v", err)
		}

		docFile := &document.DocumentFile{
			Meta: document.DocumentMeta{
				Project: "@test-project",
				Title:   "Test Canvas Updated",
				Tags:    []string{"canvas-test"},
				Created: time.Now().Add(-time.Hour),
				Updated: time.Now(),
			},
			Kind:  document.DocumentKindCanvas,
			Scene: sceneJSON,
		}

		writer := document.NewFileWriter(v)
		if err := writer.WriteFile(relativePath, docFile); err != nil {
			t.Fatalf("WriteFile() failed: %v", err)
		}

		if err := idx.ReindexDocument(ctx, relativePath); err != nil {
			t.Fatalf("ReindexDocument() failed: %v", err)
		}

		results, err := ftsStore.Search(ctx, "xyz123")
		if err != nil {
			t.Fatalf("Search() failed: %v", err)
		}

		found := false
		for _, path := range results {
			if path == relativePath {
				found = true
				break
			}
		}
		if !found {
			t.Error("Updated canvas content not found in search results")
		}
	})
}

func strPtr(s string) *string {
	return &s
}

func TestIndexer_CanvasAssetSurvivesCleanupOrphans(t *testing.T) {
	db, v := setupTestEnv(t)
	defer testutil.CleanupTestDB(t, db)

	docStore := document.NewStore(db)
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)
	assetService := asset.NewService(asset.ServiceConfig{
		DB:          db,
		Store:       assetStore,
		Vault:       v,
		SyncManager: git.NewMockSyncManager(),
	})

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

	ctx := context.Background()

	// Create a canvas document with an asset reference
	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	// Write a test asset file
	testData := []byte("test image data")
	testHash := asset.ComputeHash(testData)
	testExt := ".png"
	testRef := fmt.Sprintf("/assets/%s/%s%s", projectAlias, testHash, testExt)

	assetsDir := v.AssetsPath(projectAlias)
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		t.Fatalf("Failed to create assets dir: %v", err)
	}
	assetPath := filepath.Join(assetsDir, testHash+testExt)
	if err := os.WriteFile(assetPath, testData, 0644); err != nil {
		t.Fatalf("Failed to write test asset: %v", err)
	}

	// Insert the asset into the database with an old timestamp (> 5 minutes ago)
	// to ensure it would be considered for cleanup if not linked
	oldTime := time.Now().Add(-10 * time.Minute)
	testAsset := &asset.Asset{
		Hash:      testHash,
		Ext:       testExt,
		Bytes:     int64(len(testData)),
		MIME:      "image/png",
		CreatedAt: oldTime,
	}
	if _, err := assetStore.Upsert(ctx, testAsset); err != nil {
		t.Fatalf("Failed to insert test asset: %v", err)
	}

	// Create a canvas document that references this asset
	scene := map[string]any{
		"elements": []any{
			map[string]any{
				"id":   "text1",
				"type": "text",
				"text": "canvas with image",
			},
		},
		"appState": map[string]any{},
	}
	sceneJSON, err := json.Marshal(scene)
	if err != nil {
		t.Fatalf("Failed to marshal scene: %v", err)
	}

	docFile := &document.DocumentFile{
		Meta: document.DocumentMeta{
			Project: projectAlias,
			Title:   "Canvas With Asset",
			Tags:    []string{"canvas-asset-test"},
			Created: time.Now().Add(-time.Hour),
			Updated: time.Now(),
		},
		Kind:   document.DocumentKindCanvas,
		Scene:  sceneJSON,
		Assets: map[string]string{"file1": testRef},
	}

	relativePath := "projects/@test-project/doc-canvas-asset-test.json"
	writer := document.NewFileWriter(v)
	if err := writer.WriteFile(relativePath, docFile); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	// Index the document - this should create the doc_asset link
	if err := idx.IndexDocument(ctx, relativePath); err != nil {
		t.Fatalf("IndexDocument() failed: %v", err)
	}

	// Verify the asset is linked to the document
	linkedAssets, err := assetStore.GetDocumentAssets(ctx, relativePath)
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}
	if len(linkedAssets) != 1 {
		t.Fatalf("Expected 1 linked asset, got %d", len(linkedAssets))
	}
	if linkedAssets[0].Hash != testHash {
		t.Errorf("Linked asset hash mismatch: got %s, want %s", linkedAssets[0].Hash, testHash)
	}

	// Now run CleanupOrphans - the asset should survive because it's linked
	deleted, err := assetService.CleanupOrphans(ctx, projectAlias)
	if err != nil {
		t.Fatalf("CleanupOrphans() failed: %v", err)
	}

	// The asset should NOT have been deleted
	if deleted > 0 {
		t.Errorf("CleanupOrphans() deleted %d assets, expected 0 (asset should be linked)", deleted)
	}

	// Verify the asset still exists in the database
	_, err = assetStore.GetByHash(ctx, testHash)
	if err != nil {
		t.Errorf("Asset was deleted despite being linked: %v", err)
	}

	// Verify the asset file still exists on disk
	if _, err := os.Stat(assetPath); os.IsNotExist(err) {
		t.Error("Asset file was deleted despite being linked")
	}
}
