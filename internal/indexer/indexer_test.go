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
	"yanta/internal/document"
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

	return relPath
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
	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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
	projectStore := project.NewStore(db)
	ftsStore := search.NewStore(db)
	tagStore := tag.NewStore(db)
	linkStore := link.NewStore(db)
	assetStore := asset.NewStore(db)

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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

	idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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
		err = idx.ScanAndIndexVault(ctx)
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

		emptyIdx := New(db, emptyVault, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

		ctx := context.Background()

		// Should not error on empty vault
		err = emptyIdx.ScanAndIndexVault(ctx)
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

		newIdx := New(db, newVault, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

		ctx := context.Background()

		// Should not error on missing projects directory
		err = newIdx.ScanAndIndexVault(ctx)
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

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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
		err = idx.ScanAndIndexVault(ctx)
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

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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
		err = idx.ScanAndIndexVault(ctx)
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

		idx := New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

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
		data, err := docFile.ToJSON()
		if err != nil {
			t.Fatalf("Failed to marshal document: %v", err)
		}
		err = os.WriteFile(invalidDocPath, data, 0644)
		if err != nil {
			t.Fatalf("Failed to write document in invalid project: %v", err)
		}

		invalidRelPath := filepath.Join("projects", "invalid-project", "test-doc.json")

		// Scan the vault
		err = idx.ScanAndIndexVault(ctx)
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
		err = idx.ScanAndIndexVault(ctx)
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
