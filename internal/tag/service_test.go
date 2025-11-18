package tag

import (
	"context"
	"strings"
	"testing"

	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/project"
	"yanta/internal/testutil"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockIndexer struct {
	indexedPaths   []string
	reindexedPaths []string
	removedPaths   []string
	store          *document.Store
	fm             *document.FileManager
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
		doc := document.New(docPath, file.Meta.Project, file.Meta.Title)
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

func setupServiceTest(t *testing.T) (*Service, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)

	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	fm := document.NewFileManager(v)
	service := NewService(database, store, fm, events.NewEventBus())

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return service, cleanup
}

func TestService_Create(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, err := service.Create(context.Background(), "Frontend")
	require.NoError(t, err, "Create() failed")
	require.Equal(t, "frontend", name, "Expected normalized name")

	tag, err := service.GetByName(context.Background(), name)
	require.NoError(t, err, "GetByName() failed")
	assert.Equal(t, "frontend", tag.Name)
}

func TestService_Create_EmptyName(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	_, err := service.Create(context.Background(), "")
	assert.Error(t, err, "Expected error for empty name")
}

func TestService_Create_InvalidCharacters(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	// Normalize removes invalid characters, so "tag with @#$%" becomes "tag-with" (valid)
	name, err := service.Create(context.Background(), "tag with @#$%")
	require.NoError(t, err, "Normalize should remove invalid characters")
	assert.Equal(t, "tag-with", name, "Should normalize to valid tag name")
}

func TestService_Create_TooLong(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	// Tag names must be 1-64 characters after normalization
	longName := strings.Repeat("a", 65)
	_, err := service.Create(context.Background(), longName)
	assert.Error(t, err, "Expected error for tag name too long")
}

func TestService_GetByName(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	service.Create(context.Background(), "Backend")

	tag, err := service.GetByName(context.Background(), "backend")
	require.NoError(t, err, "GetByName() failed")
	assert.Equal(t, "backend", tag.Name)
}

func TestService_GetByName_NotFound(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	_, err := service.GetByName(context.Background(), "nonexistent")
	assert.Error(t, err, "Expected error for non-existent tag")
}

func TestService_GetByName_CaseInsensitive(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	service.Create(context.Background(), "UI-Design")

	tag, err := service.GetByName(context.Background(), "UI-DESIGN")
	require.NoError(t, err, "GetByName() should be case insensitive")
	assert.Equal(t, "ui-design", tag.Name)
}

func TestService_ListActive(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	service.Create(context.Background(), "Active1")
	service.Create(context.Background(), "Active2")
	deletedName, _ := service.Create(context.Background(), "ToDelete")
	service.SoftDelete(context.Background(), deletedName)

	tags, err := service.ListActive(context.Background())
	require.NoError(t, err, "ListActive() failed")
	assert.Equal(t, 2, len(tags), "Expected 2 active tags")

	tagNames := make(map[string]bool)
	for _, tag := range tags {
		tagNames[tag.Name] = true
	}

	assert.True(t, tagNames["active1"], "Active1 should be in list")
	assert.True(t, tagNames["active2"], "Active2 should be in list")
	assert.False(t, tagNames[deletedName], "Deleted tag should NOT be in active list")
}

func TestService_SoftDelete(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, _ := service.Create(context.Background(), "ToDelete")

	err := service.SoftDelete(context.Background(), name)
	require.NoError(t, err, "SoftDelete() failed")

	tags, _ := service.ListActive(context.Background())
	for _, tag := range tags {
		assert.NotEqual(t, name, tag.Name, "Deleted tag found in active list")
	}
}

func TestService_SoftDelete_NotFound(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.SoftDelete(context.Background(), "nonexistent")
	assert.Error(t, err, "Expected error for non-existent tag")
}

func TestService_SoftDelete_AlreadyDeleted(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, _ := service.Create(context.Background(), "ToDelete")
	service.SoftDelete(context.Background(), name)

	err := service.SoftDelete(context.Background(), name)
	assert.Error(t, err, "Expected error for already deleted tag")
}

func TestService_Restore(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, _ := service.Create(context.Background(), "ToRestore")
	service.SoftDelete(context.Background(), name)

	err := service.Restore(context.Background(), name)
	require.NoError(t, err, "Restore() failed")

	tags, _ := service.ListActive(context.Background())
	found := false
	for _, tag := range tags {
		if tag.Name == name {
			found = true
		}
	}
	assert.True(t, found, "Restored tag not found in active list")
}

func TestService_Restore_NotFound(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.Restore(context.Background(), "nonexistent")
	assert.Error(t, err, "Expected error for non-existent tag")
}

func TestService_Restore_NotDeleted(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, _ := service.Create(context.Background(), "Active")

	err := service.Restore(context.Background(), name)
	assert.Error(t, err, "Expected error for non-deleted tag")
}

func TestService_Delete(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	name, _ := service.Create(context.Background(), "ToHardDelete")

	err := service.Delete(context.Background(), name)
	require.NoError(t, err, "Delete() failed")

	_, err = service.GetByName(context.Background(), name)
	assert.Error(t, err, "Expected error getting hard deleted tag")
}

func TestService_Delete_NotFound(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.Delete(context.Background(), "nonexistent")
	assert.Error(t, err, "Expected error for non-existent tag")
}

func TestService_Normalization(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	tests := []struct {
		input    string
		expected string
	}{
		{"Frontend", "frontend"},
		{"BACKEND", "backend"},
		{"UI Design", "ui-design"},
		{"data_science", "data_science"},
		{"API-V2", "api-v2"},
		{"  spaces  ", "spaces"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			name, err := service.Create(context.Background(), tt.input)
			require.NoError(t, err, "Create() failed for %s", tt.input)
			assert.Equal(t, tt.expected, name, "Normalization failed for %s", tt.input)
		})
	}
}

func TestService_AddTagsToDocument_UpdatesJSONFile(t *testing.T) {
	// Setup database and tag service
	database := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, database)

	tagStore := NewStore(database)

	// Setup vault and document service
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	// Create test project
	projectStore := project.NewStore(database)
	p, err := project.New("Test", "@test", "", "")
	require.NoError(t, err, "Failed to create project")
	p, err = projectStore.Create(context.Background(), p)
	require.NoError(t, err, "Failed to save test project")

	// Setup document service with mocks
	docStore := document.NewStore(database)
	fm := document.NewFileManager(v)

	idx := &mockIndexer{
		store: docStore,
		fm:    fm,
	}

	projectCache := &mockProjectCache{
		projects: map[string]*project.Project{
			p.Alias: p,
		},
	}

	docService := document.NewService(database, docStore, v, idx, projectCache, events.NewEventBus())

	tagService := NewService(database, tagStore, fm, events.NewEventBus())

	// Create a test document
	docPath, err := docService.Save(context.Background(), document.SaveRequest{
		ProjectAlias: "@test",
		Title:        "Test Document",
		Blocks:       []document.BlockNoteBlock{},
		Tags:         []string{},
	})
	require.NoError(t, err, "Failed to create test document")

	// Add initial tag to database
	err = tagService.AddTagsToDocument(context.Background(), docPath, []string{"initial"})
	require.NoError(t, err, "Failed to add initial tag")

	// Add more tags via TagService
	err = tagService.AddTagsToDocument(context.Background(), docPath, []string{"web", "react"})
	require.NoError(t, err, "Failed to add tags")

	// Read document from disk to verify tags were updated in JSON file
	file, err := fm.ReadFile(docPath)
	require.NoError(t, err, "Failed to read document file")

	// Verify tags in JSON file include the new tags
	expectedTags := map[string]bool{"initial": true, "web": true, "react": true}
	assert.Equal(t, len(expectedTags), len(file.Meta.Tags), "Tag count mismatch in JSON file")

	for _, tag := range file.Meta.Tags {
		assert.True(t, expectedTags[tag], "Unexpected tag %s in JSON file", tag)
	}
}

func TestService_RemoveTagsFromDocument_UpdatesJSONFile(t *testing.T) {
	// Setup database and tag service
	database := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, database)

	tagStore := NewStore(database)

	// Setup vault and document service
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	// Create test project
	projectStore := project.NewStore(database)
	p, err := project.New("Test", "@test", "", "")
	require.NoError(t, err, "Failed to create project")
	p, err = projectStore.Create(context.Background(), p)
	require.NoError(t, err, "Failed to save test project")

	// Setup document service with mocks
	docStore := document.NewStore(database)
	fm := document.NewFileManager(v)

	idx := &mockIndexer{
		store: docStore,
		fm:    fm,
	}

	projectCache := &mockProjectCache{
		projects: map[string]*project.Project{
			p.Alias: p,
		},
	}

	docService := document.NewService(database, docStore, v, idx, projectCache, events.NewEventBus())

	tagService := NewService(database, tagStore, fm, events.NewEventBus())

	// Create a test document
	docPath, err := docService.Save(context.Background(), document.SaveRequest{
		ProjectAlias: "@test",
		Title:        "Test Document",
		Blocks:       []document.BlockNoteBlock{},
		Tags:         []string{},
	})
	require.NoError(t, err, "Failed to create test document")

	// Add tags to database
	err = tagService.AddTagsToDocument(context.Background(), docPath, []string{"web", "react", "golang"})
	require.NoError(t, err, "Failed to add tags")

	// Remove tags via TagService
	err = tagService.RemoveTagsFromDocument(context.Background(), docPath, []string{"react", "golang"})
	require.NoError(t, err, "Failed to remove tags")

	// Read document from disk to verify tags were updated in JSON file
	file, err := fm.ReadFile(docPath)
	require.NoError(t, err, "Failed to read document file")

	// Verify only "web" remains in JSON file
	require.Equal(t, 1, len(file.Meta.Tags), "Expected 1 tag remaining in JSON file")
	assert.Equal(t, "web", file.Meta.Tags[0], "Expected only 'web' tag to remain")
}

func TestService_RemoveAllDocumentTags_UpdatesJSONFile(t *testing.T) {
	// Setup database and tag service
	database := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, database)

	tagStore := NewStore(database)

	// Setup vault and document service
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	// Create test project
	projectStore := project.NewStore(database)
	p, err := project.New("Test", "@test", "", "")
	require.NoError(t, err, "Failed to create project")
	p, err = projectStore.Create(context.Background(), p)
	require.NoError(t, err, "Failed to save test project")

	// Setup document service with mocks
	docStore := document.NewStore(database)
	fm := document.NewFileManager(v)

	idx := &mockIndexer{
		store: docStore,
		fm:    fm,
	}

	projectCache := &mockProjectCache{
		projects: map[string]*project.Project{
			p.Alias: p,
		},
	}

	docService := document.NewService(database, docStore, v, idx, projectCache, events.NewEventBus())

	tagService := NewService(database, tagStore, fm, events.NewEventBus())

	// Create a test document
	docPath, err := docService.Save(context.Background(), document.SaveRequest{
		ProjectAlias: "@test",
		Title:        "Test Document",
		Blocks:       []document.BlockNoteBlock{},
		Tags:         []string{},
	})
	require.NoError(t, err, "Failed to create test document")

	// Add tags to database
	err = tagService.AddTagsToDocument(context.Background(), docPath, []string{"web", "react", "golang"})
	require.NoError(t, err, "Failed to add tags")

	// Remove all tags via TagService
	err = tagService.RemoveAllDocumentTags(context.Background(), docPath)
	require.NoError(t, err, "Failed to remove all tags")

	// Read document from disk to verify tags were cleared in JSON file
	file, err := fm.ReadFile(docPath)
	require.NoError(t, err, "Failed to read document file")

	// Verify no tags remain in JSON file
	assert.Equal(t, 0, len(file.Meta.Tags), "Expected no tags in JSON file")
}
