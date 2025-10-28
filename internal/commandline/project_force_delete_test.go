package commandline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/document"
	"yanta/internal/git"
	"yanta/internal/project"
	"yanta/internal/testutil"
	"yanta/internal/vault"
)

type noopIndexer struct{}

func (noopIndexer) IndexDocument(context.Context, string) error   { return nil }
func (noopIndexer) ReindexDocument(context.Context, string) error { return nil }
func (noopIndexer) RemoveDocument(context.Context, string) error  { return nil }

type projectCommandTestEnv struct {
	cmds           *ProjectCommands
	projectService *project.Service
	documentStore  *document.Store
	cleanup        func()
}

func setupProjectCommandTest(t *testing.T) projectCommandTestEnv {
	t.Helper()

	db := testutil.SetupTestDB(t)
	projectStore := project.NewStore(db)
	projectCache := project.NewCache(projectStore)
	projectService := project.NewService(db, projectStore, projectCache)

	docStore := document.NewStore(db)
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err)

	idx := noopIndexer{}
	docService := document.NewService(db, docStore, v, idx, projectCache)

	// Use nil for syncManager in tests - sync is not needed for these tests
	cmds := NewProjectCommands(projectService, docService, v, git.NewMockSyncManager())

	cleanup := func() {
		testutil.CleanupTestDB(t, db)
	}

	return projectCommandTestEnv{
		cmds:           cmds,
		projectService: projectService,
		documentStore:  docStore,
		cleanup:        cleanup,
	}
}

func TestProjectCommands_DeleteForceSoftDeletesProject(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	projectID, err := env.projectService.Create("Force Soft", "force", "", "")
	require.NoError(t, err)

	result, err := env.cmds.Parse("delete @force --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.False(t, result.Data.RequiresConfirmation)
	require.Equal(t, []string{"--force"}, result.Data.Flags)

	// ensure project can be restored, indicating soft deletion
	err = env.projectService.Restore(projectID)
	require.NoError(t, err)
}

func TestProjectCommands_DeleteForceSoftDeletesDocuments(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	projectID, err := env.projectService.Create("Force Soft Docs", "forcedocs", "", "")
	require.NoError(t, err)

	// create one document entry for the project
	doc := document.New("projects/@forcedocs/doc-1.json", "@forcedocs", "Doc 1")
	_, err = env.documentStore.Create(context.Background(), doc)
	require.NoError(t, err)

	result, err := env.cmds.Parse("delete @forcedocs --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.False(t, result.Data.RequiresConfirmation)
	require.Equal(t, []string{"--force"}, result.Data.Flags)

	// the project should be restorable (soft deleted)
	err = env.projectService.Restore(projectID)
	require.NoError(t, err)

	// the document should remain but marked as deleted
	storedDoc, err := env.documentStore.GetByPathIncludingDeleted(context.Background(), "projects/@forcedocs/doc-1.json")
	require.NoError(t, err)
	require.NotEmpty(t, storedDoc.DeletedAt)
}

func TestProjectCommands_DeleteSoftDeletesProject(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	projectID, err := env.projectService.Create("Soft Delete", "soft", "", "")
	require.NoError(t, err)

	result, err := env.cmds.Parse("delete @soft")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.True(t, result.Data.RequiresConfirmation)
	require.Equal(t, "delete @soft --force", result.Data.ConfirmationCommand)

	// project should still be active since confirmation not issued
	_, err = env.projectService.Get(projectID)
	require.NoError(t, err)

	confirmResult, err := env.cmds.Parse(result.Data.ConfirmationCommand)
	require.NoError(t, err)
	require.True(t, confirmResult.Success)

	err = env.projectService.Restore(projectID)
	require.NoError(t, err)
}

func TestProjectCommands_DeleteSoftDeletesDocuments(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	projectID, err := env.projectService.Create("Soft Delete Docs", "softdocs", "", "")
	require.NoError(t, err)

	doc := document.New("projects/@softdocs/doc-1.json", "@softdocs", "Doc 1")
	_, err = env.documentStore.Create(context.Background(), doc)
	require.NoError(t, err)

	result, err := env.cmds.Parse("delete @softdocs")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.True(t, result.Data.RequiresConfirmation)
	require.Equal(t, "delete @softdocs --force", result.Data.ConfirmationCommand)

	// documents should not be soft deleted yet
	storedDocActive, err := env.documentStore.GetByPath(context.Background(), "projects/@softdocs/doc-1.json")
	require.NoError(t, err)
	require.Empty(t, storedDocActive.DeletedAt)

	confirmResult, err := env.cmds.Parse(result.Data.ConfirmationCommand)
	require.NoError(t, err)
	require.True(t, confirmResult.Success)

	err = env.projectService.Restore(projectID)
	require.NoError(t, err)

	storedDoc, err := env.documentStore.GetByPathIncludingDeleted(context.Background(), "projects/@softdocs/doc-1.json")
	require.NoError(t, err)
	require.NotEmpty(t, storedDoc.DeletedAt)
}
