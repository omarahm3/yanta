package project

import (
	"context"
	"testing"

	"yanta/internal/events"
	"yanta/internal/testutil"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupServiceTest(t *testing.T, notifier SyncNotifier) (*Service, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)
	cache := NewCache(store)

	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err, "Failed to create vault")

	service := NewService(database, store, cache, v, notifier, events.NewEventBus())

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return service, cleanup
}

type mockSyncNotifier struct {
	reasons []string
}

func (m *mockSyncNotifier) NotifyChange(reason string) {
	m.reasons = append(m.reasons, reason)
}

func TestService_Create(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, err := service.Create(context.Background(), "Test Project", "test", "", "")
	require.NoError(t, err, "Create() failed")
	require.NotEmpty(t, id, "Expected non-empty ID")

	project, err := service.Get(context.Background(), id)
	require.NoError(t, err, "Get() failed")
	assert.Equal(t, "Test Project", project.Name)
	assert.Equal(t, "@test", project.Alias)
}

func TestService_Create_EmptyName(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	_, err := service.Create(context.Background(), "", "test", "", "")
	assert.Error(t, err, "Expected error for empty name")
}

func TestService_Update(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "Original", "orig", "", "")
	project, _ := service.Get(context.Background(), id)

	project.Name = "Updated"
	err := service.Update(context.Background(), project)
	require.NoError(t, err, "Update() failed")

	updated, _ := service.Get(context.Background(), id)
	assert.Equal(t, "Updated", updated.Name)
}

func TestService_Create_NotifiesSync(t *testing.T) {
	notifier := &mockSyncNotifier{}
	service, cleanup := setupServiceTest(t, notifier)
	defer cleanup()

	_, err := service.Create(context.Background(), "Sync Project", "sync", "", "")
	require.NoError(t, err)

	require.Len(t, notifier.reasons, 1)
	assert.Contains(t, notifier.reasons[0], "@sync")
	assert.Contains(t, notifier.reasons[0], "created")
}

func TestService_Update_NotifiesSync(t *testing.T) {
	notifier := &mockSyncNotifier{}
	service, cleanup := setupServiceTest(t, notifier)
	defer cleanup()

	id, err := service.Create(context.Background(), "Sync Update", "syncupd", "", "")
	require.NoError(t, err)

	project, err := service.Get(context.Background(), id)
	require.NoError(t, err)
	project.Name = "Updated Name"

	err = service.Update(context.Background(), project)
	require.NoError(t, err)

	require.GreaterOrEqual(t, len(notifier.reasons), 2)
	assert.Contains(t, notifier.reasons[len(notifier.reasons)-1], "@syncupd")
	assert.Contains(t, notifier.reasons[len(notifier.reasons)-1], "updated")
}

func TestService_SoftDelete(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "To Delete", "delete", "", "")

	err := service.SoftDelete(context.Background(), id)
	require.NoError(t, err, "SoftDelete() failed")

	projects, _ := service.ListActive(context.Background())
	for _, p := range projects {
		assert.NotEqual(t, id, p.ID, "Deleted project found in active list")
	}
}

func TestService_Restore(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "To Restore", "restore", "", "")
	service.SoftDelete(context.Background(), id)

	err := service.Restore(context.Background(), id)
	require.NoError(t, err, "Restore() failed")

	projects, _ := service.ListActive(context.Background())
	found := false
	for _, p := range projects {
		if p.ID == id {
			found = true
		}
	}
	assert.True(t, found, "Restored project not found in active list")
}

func TestService_Delete_NoDocuments(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "To Hard Delete", "hard", "", "")

	err := service.Delete(context.Background(), id)
	require.NoError(t, err, "Delete() failed")

	_, err = service.Get(context.Background(), id)
	assert.Error(t, err, "Expected error getting hard deleted project")
}

func TestService_ListActive(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	service.Create(context.Background(), "Active 1", "active1", "", "")
	service.Create(context.Background(), "Active 2", "active2", "", "")
	archivedID, _ := service.Create(context.Background(), "Archived", "archived", "", "2025-01-01")
	service.SoftDelete(context.Background(), archivedID)

	projects, err := service.ListActive(context.Background())
	require.NoError(t, err, "ListActive() failed")
	assert.Equal(t, 2, len(projects), "Expected 2 active projects (archived excluded)")
}

func TestService_ListArchived(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	activeID, _ := service.Create(context.Background(), "Active", "active", "", "")
	archivedID1, _ := service.Create(context.Background(), "Archived 1", "arch1", "", "2025-01-01")
	archivedID2, _ := service.Create(context.Background(), "Archived 2", "arch2", "", "2025-01-02")

	service.SoftDelete(context.Background(), archivedID1)
	service.SoftDelete(context.Background(), archivedID2)

	projects, err := service.ListArchived(context.Background())
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
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	cache := service.GetCache()
	assert.NotNil(t, cache, "GetCache() returned nil")
}

func TestService_DocumentCounts(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "Test Project", "test", "", "")

	counts, err := service.GetAllDocumentCounts(context.Background())
	require.NoError(t, err, "GetAllDocumentCounts() failed")
	assert.Equal(t, 0, counts[id], "Expected 0 documents for new project")

	err = service.UpdateDocumentCount(context.Background(), id)
	require.NoError(t, err, "UpdateDocumentCount() failed")

	cachedCount := service.cache.GetDocumentCount(id)
	assert.Equal(t, 0, cachedCount, "Expected cached count to be 0")
}

func TestService_LastDocumentDates(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	service.Create(context.Background(), "Test Project", "test", "", "")

	dates, err := service.GetAllLastDocumentDates(context.Background())
	require.NoError(t, err, "GetAllLastDocumentDates() failed")
	assert.NotNil(t, dates, "Expected non-nil dates map")
}

func TestService_HardDelete(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	id, _ := service.Create(context.Background(), "To Hard Delete", "hard", "", "")

	err := service.HardDelete(context.Background(), id)
	require.NoError(t, err, "HardDelete() failed")

	_, err = service.Get(context.Background(), id)
	assert.Error(t, err, "Expected error getting hard deleted project")
}

func TestService_HardDelete_EmptyID(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	err := service.HardDelete(context.Background(), "")
	assert.Error(t, err, "Expected error for empty ID")
}

func TestService_HardDelete_NonExistent(t *testing.T) {
	service, cleanup := setupServiceTest(t, nil)
	defer cleanup()

	err := service.HardDelete(context.Background(), "non-existent-id")
	assert.Error(t, err, "Expected error for non-existent project")
}
