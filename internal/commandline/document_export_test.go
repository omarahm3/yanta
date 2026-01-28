package commandline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type mockDocServiceForExport struct{}

func (m *mockDocServiceForExport) SoftDelete(ctx context.Context, path string) error {
	return nil
}

func (m *mockDocServiceForExport) Restore(ctx context.Context, path string) error {
	return nil
}

func (m *mockDocServiceForExport) HardDelete(ctx context.Context, path string) error {
	return nil
}

func (m *mockDocServiceForExport) HardDeleteBatch(ctx context.Context, paths []string) error {
	return nil
}

type mockTagServiceForExport struct{}

func (m *mockTagServiceForExport) AddTagsToDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (m *mockTagServiceForExport) RemoveTagsFromDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (m *mockTagServiceForExport) RemoveAllDocumentTags(
	ctx context.Context,
	docPath string,
) error {
	return nil
}

func (m *mockTagServiceForExport) GetDocumentTags(
	ctx context.Context,
	docPath string,
) ([]string, error) {
	return []string{}, nil
}

func TestDocumentCommandExport_WithExplicitPath(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("export test/doc.json")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Equal(t, "export document", result.Message)
	require.Equal(t, "test/doc.json", result.Data.DocumentPath)
}

func TestDocumentCommandExport_WithCurrentDocument(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)
	cmds.SetCurrentDocument("current/doc.json")

	result, err := cmds.Parse("export")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Equal(t, "export document", result.Message)
	require.Equal(t, "current/doc.json", result.Data.DocumentPath)
}

func TestDocumentCommandExport_NoDocumentOpen(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("export")
	require.NoError(t, err)
	require.False(t, result.Success)
	require.Equal(t, "no document open - use in document editor or specify path", result.Message)
}
