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

func TestDocumentCommands_ExportPDFRequiresDocument(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.Parse("export-pdf")
	require.NoError(t, err)
	require.False(t, result.Success)
	require.Equal(t, "no document open - use in document editor", result.Message)
}

func TestDocumentCommands_ExportPDFWithDocument(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	result, err := cmds.ParseWithDocument("export-pdf", "test/doc.json")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Equal(t, "export to PDF", result.Message)
	require.Equal(t, "test/doc.json", result.Data.DocumentPath)
}

func TestDocumentCommands_ExportPDFWithSetCurrentDocument(t *testing.T) {
	docSvc := &mockDocServiceForExport{}
	tagSvc := &mockTagServiceForExport{}
	cmds := NewDocumentCommands(docSvc, tagSvc)

	cmds.SetCurrentDocument("another/doc.json")
	result, err := cmds.Parse("export-pdf")
	require.NoError(t, err)
	require.True(t, result.Success)
	require.Equal(t, "export to PDF", result.Message)
	require.Equal(t, "another/doc.json", result.Data.DocumentPath)
}
