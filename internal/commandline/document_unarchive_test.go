package commandline

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDocumentService struct {
	lastRestoredPath string
	restoreErr       error
}

func (m *mockDocumentService) SoftDelete(path string) error { return nil }

func (m *mockDocumentService) Restore(path string) error {
	m.lastRestoredPath = path
	return m.restoreErr
}

func (m *mockDocumentService) HardDelete(path string) error { return nil }

func (m *mockDocumentService) HardDeleteBatch(paths []string) error { return nil }

type noopTagService struct{}

func (n *noopTagService) AddTagsToDocument(string, []string) error { return nil }

func (n *noopTagService) RemoveTagsFromDocument(string, []string) error { return nil }

func (n *noopTagService) RemoveAllDocumentTags(string) error { return nil }

func (n *noopTagService) GetDocumentTags(string) ([]string, error) { return []string{}, nil }

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
