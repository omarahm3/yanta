package commandline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/document"
)

func TestProjectCommands_ArchiveRequiresConfirmation(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	_, err := env.projectService.Create("Archive Test", "archtest", "", "")
	require.NoError(t, err)

	result, err := env.cmds.Parse("archive @archtest")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.True(t, result.Data.RequiresConfirmation)
	require.Equal(t, "archive @archtest --force", result.Data.ConfirmationCommand)
}

func TestProjectCommands_ArchiveForceBypassesConfirmation(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	projectID, err := env.projectService.Create("Archive Force", "archforce", "", "")
	require.NoError(t, err)

	result, err := env.cmds.Parse("archive @archforce --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.NotNil(t, result.Data)
	require.False(t, result.Data.RequiresConfirmation)
	require.Equal(t, []string{"--force"}, result.Data.Flags)

	err = env.projectService.Restore(projectID)
	require.NoError(t, err)
}

func TestProjectCommands_ArchiveShowsEntryCount(t *testing.T) {
	env := setupProjectCommandTest(t)
	defer env.cleanup()

	_, err := env.projectService.Create("Archive Entries", "archentries", "", "")
	require.NoError(t, err)

	doc := document.New("projects/@archentries/doc-1.json", "@archentries", "Doc 1")
	_, err = env.documentStore.Create(context.Background(), doc)
	require.NoError(t, err)

	result, err := env.cmds.Parse("archive @archentries")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Contains(t, result.Message, "1 entries")
}
