package project

import (
	"context"
	"testing"

	"yanta/internal/testutil"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupServiceTest(t *testing.T) (*Service, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)
	cache := NewCache(store)

	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	service := NewService(database, store, cache, v)

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return service, cleanup
}

func TestService_Create(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, err := service.Create("Test Project", "test", "", "")
	require.NoError(t, err, "Create() failed")
	require.NotEmpty(t, id, "Expected non-empty ID")

	project, err := service.Get(id)
	require.NoError(t, err, "Get() failed")
	assert.Equal(t, "Test Project", project.Name)
	assert.Equal(t, "@test", project.Alias)
}

func TestService_Create_EmptyName(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	_, err := service.Create("", "test", "", "")
	assert.Error(t, err, "Expected error for empty name")
}

func TestService_Update(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("Original", "orig", "", "")
	project, _ := service.Get(id)

	project.Name = "Updated"
	err := service.Update(project)
	require.NoError(t, err, "Update() failed")

	updated, _ := service.Get(id)
	assert.Equal(t, "Updated", updated.Name)
}

func TestService_SoftDelete(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("To Delete", "delete", "", "")

	err := service.SoftDelete(id)
	require.NoError(t, err, "SoftDelete() failed")

	projects, _ := service.ListActive()
	for _, p := range projects {
		assert.NotEqual(t, id, p.ID, "Deleted project found in active list")
	}
}

func TestService_Restore(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("To Restore", "restore", "", "")
	service.SoftDelete(id)

	err := service.Restore(id)
	require.NoError(t, err, "Restore() failed")

	projects, _ := service.ListActive()
	found := false
	for _, p := range projects {
		if p.ID == id {
			found = true
		}
	}
	assert.True(t, found, "Restored project not found in active list")
}

func TestService_Delete_NoDocuments(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("To Hard Delete", "hard", "", "")

	err := service.Delete(id)
	require.NoError(t, err, "Delete() failed")

	_, err = service.Get(id)
	assert.Error(t, err, "Expected error getting hard deleted project")
}

func TestService_ListActive(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	service.Create("Active 1", "active1", "", "")
	service.Create("Active 2", "active2", "", "")
	archivedID, _ := service.Create("Archived", "archived", "", "2025-01-01")
	service.SoftDelete(archivedID)

	projects, err := service.ListActive()
	require.NoError(t, err, "ListActive() failed")
	assert.Equal(t, 2, len(projects), "Expected 2 active projects (archived excluded)")
}

func TestService_ListArchived(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	activeID, _ := service.Create("Active", "active", "", "")
	archivedID1, _ := service.Create("Archived 1", "arch1", "", "2025-01-01")
	archivedID2, _ := service.Create("Archived 2", "arch2", "", "2025-01-02")

	service.SoftDelete(archivedID1)
	service.SoftDelete(archivedID2)

	projects, err := service.ListArchived()
	require.NoError(t, err, "ListArchived() failed")
	assert.Equal(t, 2, len(projects), "Expected 2 archived projects")

	foundIDs := make(map[string]bool)
	for _, p := range projects {
		foundIDs[p.ID] = true
	}

	assert.True(t, foundIDs[archivedID1], "Archived 1 should be in list")
	assert.True(t, foundIDs[archivedID2], "Archived 2 should be in list")
	assert.False(t, foundIDs[activeID], "Active project should NOT be in archived list")
}

func TestService_GetCache(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	cache := service.GetCache()
	assert.NotNil(t, cache, "GetCache() returned nil")
}

func TestService_SetContext(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	ctx := context.WithValue(context.Background(), "test", "value")
	service.SetContext(ctx)

	assert.Equal(t, ctx, service.ctx, "Context not set correctly")
}

func TestService_DocumentCounts(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("Test Project", "test", "", "")

	counts, err := service.GetAllDocumentCounts()
	require.NoError(t, err, "GetAllDocumentCounts() failed")
	assert.Equal(t, 0, counts[id], "Expected 0 documents for new project")

	err = service.UpdateDocumentCount(id)
	require.NoError(t, err, "UpdateDocumentCount() failed")

	cachedCount := service.cache.GetDocumentCount(id)
	assert.Equal(t, 0, cachedCount, "Expected cached count to be 0")
}

func TestService_LastDocumentDates(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	service.Create("Test Project", "test", "", "")

	dates, err := service.GetAllLastDocumentDates()
	require.NoError(t, err, "GetAllLastDocumentDates() failed")
	assert.NotNil(t, dates, "Expected non-nil dates map")
}

func TestService_HardDelete(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	id, _ := service.Create("To Hard Delete", "hard", "", "")

	err := service.HardDelete(id)
	require.NoError(t, err, "HardDelete() failed")

	_, err = service.Get(id)
	assert.Error(t, err, "Expected error getting hard deleted project")
}

func TestService_HardDelete_EmptyID(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.HardDelete("")
	assert.Error(t, err, "Expected error for empty ID")
}

func TestService_HardDelete_NonExistent(t *testing.T) {
	service, cleanup := setupServiceTest(t)
	defer cleanup()

	err := service.HardDelete("non-existent-id")
	assert.Error(t, err, "Expected error for non-existent project")
}
