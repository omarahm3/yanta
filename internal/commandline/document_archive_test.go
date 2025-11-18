package commandline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type mockDocServiceForArchive struct {
	softDeletedPaths []string
	hardDeletedPaths []string
}

func (m *mockDocServiceForArchive) SoftDelete(ctx context.Context, path string) error {
	m.softDeletedPaths = append(m.softDeletedPaths, path)
	return nil
}

func (m *mockDocServiceForArchive) Restore(ctx context.Context, path string) error {
	return nil
}

func (m *mockDocServiceForArchive) HardDelete(ctx context.Context, path string) error {
	m.hardDeletedPaths = append(m.hardDeletedPaths, path)
	return nil
}

func (m *mockDocServiceForArchive) HardDeleteBatch(ctx context.Context, paths []string) error {
	m.hardDeletedPaths = append(m.hardDeletedPaths, paths...)
	return nil
}

type mockTagServiceForArchive struct{}

func (m *mockTagServiceForArchive) AddTagsToDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (m *mockTagServiceForArchive) RemoveTagsFromDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (m *mockTagServiceForArchive) RemoveAllDocumentTags(
	ctx context.Context,
	docPath string,
) error {
	return nil
}

func (m *mockTagServiceForArchive) GetDocumentTags(
	ctx context.Context,
	docPath string,
) ([]string, error) {
	return []string{}, nil
}

func TestDocumentCommands_ArchiveRequiresConfirmation(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("archive test/doc.json")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.True(t, result.Data.RequiresConfirmation)
	require.Equal(t, "archive test/doc.json --force", result.Data.ConfirmationCommand)
	require.Len(t, docSvc.softDeletedPaths, 0)
}

func TestDocumentCommands_ArchiveForceBypassesConfirmation(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("archive test/doc.json --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.False(t, result.Data.RequiresConfirmation)
	require.Len(t, docSvc.softDeletedPaths, 1)
	require.Equal(t, "test/doc.json", docSvc.softDeletedPaths[0])
}

func TestDocumentCommands_DeleteRequiresConfirmation(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("delete test/doc.json")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.True(t, result.Data.RequiresConfirmation)
	require.Equal(t, "delete test/doc.json --force", result.Data.ConfirmationCommand)
	require.Len(t, docSvc.softDeletedPaths, 0)
}

func TestDocumentCommands_DeleteForceBypassesConfirmation(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("delete test/doc.json --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.False(t, result.Data.RequiresConfirmation)
	require.Len(t, docSvc.softDeletedPaths, 1)
	require.Equal(t, "test/doc.json", docSvc.softDeletedPaths[0])
}

func TestDocumentCommands_DeleteHardExecutesImmediately(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("delete test/doc.json --hard")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Len(t, docSvc.hardDeletedPaths, 1)
	require.Equal(t, "test/doc.json", docSvc.hardDeletedPaths[0])
}

func TestDocumentCommands_DeleteForceHardBypassesConfirmation(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("delete test/doc.json --force --hard")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Len(t, docSvc.hardDeletedPaths, 1)
	require.Equal(t, "test/doc.json", docSvc.hardDeletedPaths[0])
}

func TestDocumentCommands_ArchiveMultipleDocuments(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("archive doc1.json,doc2.json,doc3.json --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Len(t, docSvc.softDeletedPaths, 3)
}

func TestDocumentCommands_DeleteMultipleDocuments(t *testing.T) {
	docSvc := &mockDocServiceForArchive{}
	tagSvc := &mockTagServiceForArchive{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("delete doc1.json,doc2.json --force")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Len(t, docSvc.softDeletedPaths, 2)
}
