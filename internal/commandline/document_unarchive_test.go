package commandline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDocumentService struct {
	lastRestoredPath string
	restoredPaths    []string
	restoreErr       error
}

func (m *mockDocumentService) SoftDelete(ctx context.Context, path string) error { return nil }

func (m *mockDocumentService) Restore(ctx context.Context, path string) error {
	m.lastRestoredPath = path
	m.restoredPaths = append(m.restoredPaths, path)
	return m.restoreErr
}

func (m *mockDocumentService) HardDelete(ctx context.Context, path string) error { return nil }

func (m *mockDocumentService) HardDeleteBatch(
	ctx context.Context,
	paths []string,
) error {
	return nil
}

type noopTagService struct{}

func (n *noopTagService) AddTagsToDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (n *noopTagService) RemoveTagsFromDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	return nil
}

func (n *noopTagService) RemoveAllDocumentTags(
	ctx context.Context,
	docPath string,
) error {
	return nil
}

func (n *noopTagService) GetDocumentTags(ctx context.Context, docPath string) ([]string, error) {
	return []string{}, nil
}

func TestDocumentCommands_UnarchiveUsesCurrentDocument(t *testing.T) {
	docSvc := &mockDocumentService{}
	cmds := NewDocumentCommands(docSvc, &noopTagService{})

	result, err := cmds.ParseWithDocument("unarchive", "projects/test/doc.json")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.True(t, result.Success)
	assert.Equal(t, "document unarchived", result.Message)
	assert.Equal(t, "projects/test/doc.json", docSvc.lastRestoredPath)
}

func TestDocumentCommands_UnarchiveExplicitPath(t *testing.T) {
	docSvc := &mockDocumentService{}
	cmds := NewDocumentCommands(docSvc, &noopTagService{})

	result, err := cmds.Parse("unarchive projects/test/doc.json")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.True(t, result.Success)
	assert.Equal(t, "document unarchived", result.Message)
	assert.Equal(t, "projects/test/doc.json", docSvc.lastRestoredPath)
}

func TestDocumentCommands_UnarchiveMultiplePaths(t *testing.T) {
	docSvc := &mockDocumentService{}
	cmds := NewDocumentCommands(docSvc, &noopTagService{})

	result, err := cmds.Parse("unarchive projects/test/doc1.json, projects/test/doc2.json")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.True(t, result.Success)
	assert.Equal(t, "2 documents unarchived", result.Message)
	assert.Equal(t, []string{"projects/test/doc1.json", "projects/test/doc2.json"}, docSvc.restoredPaths)
}

func TestDocumentCommands_UnarchiveWithoutContextFails(t *testing.T) {
	docSvc := &mockDocumentService{}
	cmds := NewDocumentCommands(docSvc, &noopTagService{})

	result, err := cmds.Parse("unarchive")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.False(t, result.Success)
	assert.Equal(t, "no document open - use in document editor", result.Message)
	assert.Equal(t, "", docSvc.lastRestoredPath)
}
