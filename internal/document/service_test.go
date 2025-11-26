package document

import (
	"context"
	"os"
	"testing"

	"yanta/internal/events"
	"yanta/internal/logger"
	"yanta/internal/project"
	"yanta/internal/testutil"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMain ensures logger cleanup after all tests complete
// This prevents file handle leaks that cause test hangs
func TestMain(m *testing.M) {
	// Run all tests
	code := m.Run()

	// Close logger file handle to prevent hang
	// Must be called before os.Exit() as defer doesn't work with os.Exit()
	logger.Close()

	os.Exit(code)
}

type mockIndexer struct {
	indexedPaths   []string
	reindexedPaths []string
	removedPaths   []string
	store          *Store
	fm             *FileManager
}

type mockProjectCache struct {
	projects map[string]*project.Project
}

func (m *mockProjectCache) GetByAlias(ctx context.Context, alias string) (*project.Project, error) {
	if p, ok := m.projects[alias]; ok {
		return p, nil
	}
	return nil, assert.AnError
}

func (m *mockIndexer) IndexDocument(ctx context.Context, docPath string) error {
	m.indexedPaths = append(m.indexedPaths, docPath)

	file, err := m.fm.ReadFile(docPath)
	if err != nil {
		return err
	}

	existing, err := m.store.GetByPath(ctx, docPath)
	if err != nil {
		doc := New(docPath, file.Meta.Project, file.Meta.Title)
		_, err = m.store.Create(ctx, doc)
		return err
	}

	existing.Title = file.Meta.Title
	_, err = m.store.Update(ctx, existing)
	return err
}

func (m *mockIndexer) ReindexDocument(ctx context.Context, docPath string) error {
	m.reindexedPaths = append(m.reindexedPaths, docPath)

	file, err := m.fm.ReadFile(docPath)
	if err != nil {
		return err
	}

	existingDoc, err := m.store.GetByPath(ctx, docPath)
	if err != nil {
		return err
	}

	existingDoc.Title = file.Meta.Title
	_, err = m.store.Update(ctx, existingDoc)
	return err
}

func (m *mockIndexer) RemoveDocument(ctx context.Context, docPath string) error {
	m.removedPaths = append(m.removedPaths, docPath)
	return m.store.SoftDelete(ctx, docPath)
}

func setupServiceTest(t *testing.T) (*Service, *vault.Vault, func()) {
	database := testutil.SetupTestDB(t)

	tmpDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tmpDir})
	require.NoError(t, err, "failed to create vault")

	projectStore := project.NewStore(database)
	p, err := project.New("Test", "@test", "", "")
	require.NoError(t, err, "failed to create project")
	p, err = projectStore.Create(context.Background(), p)
	require.NoError(t, err, "failed to save test project")

	docStore := NewStore(database)
	fm := NewFileManager(v)

	idx := &mockIndexer{
		store: docStore,
		fm:    fm,
	}

	projectCache := &mockProjectCache{
		projects: map[string]*project.Project{
			p.Alias: p,
		},
	}

	service := NewService(database, docStore, v, idx, projectCache, events.NewEventBus())

	cleanup := func() {
		// Close logger to prevent file handle leak
		logger.Close()
		testutil.CleanupTestDB(t, database)
	}

	return service, v, cleanup
}

func TestService_Save_Create(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Test Document",
		Blocks: []BlockNoteBlock{
			{
				ID:   "block1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Hello World"},
				}),
			},
		},
		Tags: []string{"test", "sample"},
	}

	path, err := service.Save(context.Background(), req)
	require.NoError(t, err, "Save() failed")
	require.NotEmpty(t, path, "Expected non-empty path")

	assert.Contains(t, path, "projects/@test/doc-")
	assert.Contains(t, path, ".json")

	doc, err := service.Get(context.Background(), path)
	require.NoError(t, err, "Get() failed")
	assert.Equal(t, "Test Document", doc.Title)
	assert.Equal(t, "@test", doc.ProjectAlias)
	assert.Len(t, doc.Tags, 2)
}

func TestService_Save_Update(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	createReq := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Original Title",
		Blocks: []BlockNoteBlock{
			{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]BlockNoteContent{{Type: "text", Text: "Original"}})},
		},
		Tags: []string{"original"},
	}

	path, err := service.Save(context.Background(), createReq)
	require.NoError(t, err, "Create failed")

	updateReq := SaveRequest{
		Path:         path,
		ProjectAlias: "@test",
		Title:        "Updated Title",
		Blocks: []BlockNoteBlock{
			{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]BlockNoteContent{{Type: "text", Text: "Updated"}})},
		},
		Tags: []string{"updated"},
	}

	updatedPath, err := service.Save(context.Background(), updateReq)
	require.NoError(t, err, "Update failed")
	assert.Equal(t, path, updatedPath, "Path should remain the same")

	doc, err := service.Get(context.Background(), path)
	require.NoError(t, err, "Get() failed")
	assert.Equal(t, "Updated Title", doc.Title)
	assert.Contains(t, doc.Tags, "updated")
}

func TestService_Save_EmptyProjectAlias(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "",
		Title:        "Test",
		Blocks:       []BlockNoteBlock{},
	}

	_, err := service.Save(context.Background(), req)
	assert.Error(t, err, "Expected error for empty project_alias")
	assert.Contains(t, err.Error(), "invalid project_alias")
}

func TestService_Save_EmptyTitle(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "",
		Blocks:       []BlockNoteBlock{},
	}

	_, err := service.Save(context.Background(), req)
	assert.Error(t, err, "Expected error for empty title")
	assert.Contains(t, err.Error(), "title is required")
}

func TestService_Get(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Get Test",
		Blocks: []BlockNoteBlock{
			{
				ID:   "block1",
				Type: "heading",
				Props: map[string]any{
					"level": 1,
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Heading"},
				}),
			},
		},
		Tags: []string{"test"},
	}

	path, _ := service.Save(context.Background(), req)

	doc, err := service.Get(context.Background(), path)
	require.NoError(t, err, "Get() failed")
	assert.Equal(t, "Get Test", doc.Title)
	assert.Equal(t, "@test", doc.ProjectAlias)
	assert.NotNil(t, doc.File)
	assert.Len(t, doc.File.Blocks, 1)
	assert.Equal(t, "heading", doc.File.Blocks[0].Type)
}

func TestService_Get_IncludesArchived(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Archived Doc",
		Blocks:       []BlockNoteBlock{},
	}

	path, _ := service.Save(context.Background(), req)
	err := service.SoftDelete(context.Background(), path)
	require.NoError(t, err, "SoftDelete() failed")

	doc, err := service.Get(context.Background(), path)
	require.NoError(t, err, "Get() should return archived documents")
	assert.Equal(t, path, doc.Path)
	assert.NotEmpty(t, doc.DeletedAt, "archived document should expose deleted timestamp")
}

func TestService_Get_EmptyPath(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	_, err := service.Get(context.Background(), "")
	assert.Error(t, err, "Expected error for empty path")
	assert.Contains(t, err.Error(), "path is required")
}

func TestService_ListByProject(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	for i := 1; i <= 3; i++ {
		req := SaveRequest{
			ProjectAlias: "@test",
			Title:        "Document " + string(rune('0'+i)),
			Blocks:       []BlockNoteBlock{},
			Tags:         []string{},
		}
		_, err := service.Save(context.Background(), req)
		require.NoError(t, err, "Failed to create document %d", i)
	}

	docs, err := service.ListByProject(context.Background(), "@test", false, 10, 0)
	require.NoError(t, err, "ListByProject() failed")
	assert.Len(t, docs, 3, "Expected 3 documents")
}

func TestService_ListByProject_Pagination(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	for i := 1; i <= 5; i++ {
		req := SaveRequest{
			ProjectAlias: "@test",
			Title:        "Document " + string(rune('0'+i)),
			Blocks:       []BlockNoteBlock{},
		}
		_, err := service.Save(context.Background(), req)
		require.NoError(t, err)
	}

	page1, err := service.ListByProject(context.Background(), "@test", false, 2, 0)
	require.NoError(t, err)
	assert.Len(t, page1, 2)

	page2, err := service.ListByProject(context.Background(), "@test", false, 2, 2)
	require.NoError(t, err)
	assert.Len(t, page2, 2)

	page3, err := service.ListByProject(context.Background(), "@test", false, 2, 4)
	require.NoError(t, err)
	assert.Len(t, page3, 1)
}

func TestService_ListByProject_EmptyAlias(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	_, err := service.ListByProject(context.Background(), "", false, 10, 0)
	assert.Error(t, err, "Expected error for empty project_alias")
}

func TestService_SoftDelete(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "To Delete",
		Blocks:       []BlockNoteBlock{},
	}

	path, _ := service.Save(context.Background(), req)

	err := service.SoftDelete(context.Background(), path)
	require.NoError(t, err, "SoftDelete() failed")

	docs, _ := service.ListByProject(context.Background(), "@test", false, 10, 0)
	for _, d := range docs {
		assert.NotEqual(t, path, d.Path, "Deleted document found in active list")
	}
}

func TestService_SoftDelete_EmptyPath(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.SoftDelete(context.Background(), "")
	assert.Error(t, err, "Expected error for empty path")
}

func TestService_Restore(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "To Restore",
		Blocks:       []BlockNoteBlock{},
	}

	path, _ := service.Save(context.Background(), req)
	service.SoftDelete(context.Background(), path)

	err := service.Restore(context.Background(), path)
	require.NoError(t, err, "Restore() failed")

	docs, _ := service.ListByProject(context.Background(), "@test", false, 10, 0)
	found := false
	for _, d := range docs {
		if d.Path == path {
			found = true
		}
	}
	assert.True(t, found, "Restored document not found in active list")
}

func TestService_Restore_EmptyPath(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.Restore(context.Background(), "")
	assert.Error(t, err, "Expected error for empty path")
}

func TestService_HardDelete(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "To Hard Delete",
		Blocks:       []BlockNoteBlock{},
	}

	path, err := service.Save(context.Background(), req)
	require.NoError(t, err, "Save() failed")

	err = service.HardDelete(context.Background(), path)
	require.NoError(t, err, "HardDelete() failed")

	_, err = service.Get(context.Background(), path)
	assert.Error(t, err, "Expected error getting hard deleted document")

	exists, _ := service.fm.FileExists(path)
	assert.False(t, exists, "Document file should not exist after hard delete")
}

func TestService_HardDelete_EmptyPath(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.HardDelete(context.Background(), "")
	assert.Error(t, err, "Expected error for empty path")
}

func TestService_HardDelete_RemovesFromVault(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Vault Test",
		Blocks:       []BlockNoteBlock{},
	}

	path, _ := service.Save(context.Background(), req)

	exists, _ := service.fm.FileExists(path)
	require.True(t, exists, "File should exist before deletion")

	err := service.HardDelete(context.Background(), path)
	require.NoError(t, err, "HardDelete() failed")

	exists, _ = service.fm.FileExists(path)
	assert.False(t, exists, "File should not exist after hard delete")
}

func TestService_HardDeleteBatch(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	var paths []string
	for i := 1; i <= 3; i++ {
		req := SaveRequest{
			ProjectAlias: "@test",
			Title:        "Batch Delete " + string(rune('0'+i)),
			Blocks:       []BlockNoteBlock{},
		}
		path, err := service.Save(context.Background(), req)
		require.NoError(t, err)
		paths = append(paths, path)
	}

	err := service.HardDeleteBatch(context.Background(), paths)
	require.NoError(t, err, "HardDeleteBatch() failed")

	for _, path := range paths {
		_, err := service.Get(context.Background(), path)
		assert.Error(t, err, "Expected error getting hard deleted document")
	}
}

func TestService_HardDeleteBatch_EmptyPaths(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.HardDeleteBatch(context.Background(), []string{})
	assert.Error(t, err, "Expected error for empty paths")
}

func TestService_HardDeleteBatch_PartialFailure(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	req := SaveRequest{
		ProjectAlias: "@test",
		Title:        "Valid Document",
		Blocks:       []BlockNoteBlock{},
	}
	validPath, _ := service.Save(context.Background(), req)

	paths := []string{
		validPath,
		"projects/@test/invalid-doc.json",
	}

	err := service.HardDeleteBatch(context.Background(), paths)
	assert.Error(t, err, "Expected error for batch with invalid path")

	_, err = service.Get(context.Background(), validPath)
	assert.NoError(t, err, "Valid document should still exist after failed batch")
}

func TestService_HardDeleteByProject(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	for i := 1; i <= 3; i++ {
		req := SaveRequest{
			ProjectAlias: "@test",
			Title:        "Project Doc " + string(rune('0'+i)),
			Blocks:       []BlockNoteBlock{},
		}
		_, err := service.Save(context.Background(), req)
		require.NoError(t, err)
	}

	err := service.HardDeleteByProject(context.Background(), "@test")
	require.NoError(t, err, "HardDeleteByProject() failed")

	result, err := service.ListByProject(context.Background(), "@test", false, 100, 0)
	require.NoError(t, err)
	assert.Empty(t, result, "All documents should be hard deleted")
}

func TestService_HardDeleteByProject_IncludesSoftDeleted(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	var paths []string
	for i := 1; i <= 3; i++ {
		req := SaveRequest{
			ProjectAlias: "@test",
			Title:        "Mixed Doc " + string(rune('0'+i)),
			Blocks:       []BlockNoteBlock{},
		}
		path, err := service.Save(context.Background(), req)
		require.NoError(t, err)
		paths = append(paths, path)
	}

	err := service.SoftDelete(context.Background(), paths[0])
	require.NoError(t, err, "SoftDelete() failed")

	err = service.HardDeleteByProject(context.Background(), "@test")
	require.NoError(t, err, "HardDeleteByProject() failed")

	for _, path := range paths {
		_, err := service.Get(context.Background(), path)
		assert.Error(t, err, "All documents (active and soft-deleted) should be hard deleted")
	}
}

func TestService_HardDeleteByProject_EmptyAlias(t *testing.T) {
	service, _, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.HardDeleteByProject(context.Background(), "")
	assert.Error(t, err, "Expected error for empty project alias")
}
