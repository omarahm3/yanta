package indexer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"yanta/internal/document"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockIndexer struct {
	indexed []string
	removed []string
	mu      sync.Mutex
}

func (m *mockIndexer) IndexDocument(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.indexed = append(m.indexed, path)
	return nil
}

func (m *mockIndexer) RemoveDocument(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.removed = append(m.removed, path)
	return nil
}

func (m *mockIndexer) RemoveDocumentCompletely(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.removed = append(m.removed, path)
	return nil
}

func (m *mockIndexer) ClearIndex(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.indexed = nil
	m.removed = nil
	return nil
}

func createTestVault(t *testing.T) *vault.Vault {
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err)
	return v
}

func createProjectDir(t *testing.T, v *vault.Vault, projectAlias string) {
	projectPath := v.ProjectPath(projectAlias)
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)
}

func createDocumentInVault(t *testing.T, v *vault.Vault, projectAlias, title string) string {
	createProjectDir(t, v, projectAlias)

	docFile := document.NewDocumentFile(projectAlias, title, nil)
	writer := document.NewFileWriter(v)

	aliasSlug := strings.TrimPrefix(projectAlias, "@")
	filename := fmt.Sprintf("doc-%s-%d.json", aliasSlug, time.Now().UnixNano())
	relPath := filepath.Join("projects", projectAlias, filename)

	err := writer.WriteFile(relPath, docFile)
	require.NoError(t, err)

	return relPath
}

func modifyDocument(t *testing.T, v *vault.Vault, relPath, newContent string) {
	reader := document.NewFileReader(v)
	docFile, err := reader.ReadFile(relPath)
	require.NoError(t, err)

	docFile.Meta.Title = newContent
	docFile.UpdateTimestamp()

	writer := document.NewFileWriter(v)
	err = writer.WriteFile(relPath, docFile)
	require.NoError(t, err)
}

func deleteDocument(t *testing.T, v *vault.Vault, relPath string) {
	fullPath, err := v.DocumentPath(relPath)
	require.NoError(t, err)

	err = os.Remove(fullPath)
	require.NoError(t, err)
}

func createFileInVault(t *testing.T, v *vault.Vault, projectAlias, filename, content string) {
	createProjectDir(t, v, projectAlias)

	fullPath := filepath.Join(v.ProjectPath(projectAlias), filename)
	dir := filepath.Dir(fullPath)

	err := os.MkdirAll(dir, 0755)
	require.NoError(t, err)

	err = os.WriteFile(fullPath, []byte(content), 0644)
	require.NoError(t, err)
}

func TestWatcher_CreateDocument(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@test-project")
	time.Sleep(200 * time.Millisecond)

	docPath := createDocumentInVault(t, v, "@test-project", "Test Document")

	time.Sleep(1 * time.Second)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	assert.Contains(t, mockIdx.indexed, docPath, "document should be indexed")
}

func TestWatcher_DebounceRapidWrites(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx,
		WithDebounceWindow(200*time.Millisecond))
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@test-project")
	time.Sleep(200 * time.Millisecond)

	docPath := createDocumentInVault(t, v, "@test-project", "Test")
	time.Sleep(300 * time.Millisecond)

	mockIdx.mu.Lock()
	initialCount := len(mockIdx.indexed)
	mockIdx.mu.Unlock()

	for i := 0; i < 10; i++ {
		modifyDocument(t, v, docPath, fmt.Sprintf("Content %d", i))
		time.Sleep(10 * time.Millisecond)
	}

	time.Sleep(400 * time.Millisecond)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	totalIndexed := len(mockIdx.indexed)
	newIndexes := totalIndexed - initialCount

	assert.Equal(t, 1, newIndexes, "rapid writes should be debounced to single index")
}

func TestWatcher_DeleteDocument(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@test-project")
	time.Sleep(200 * time.Millisecond)

	docPath := createDocumentInVault(t, v, "@test-project", "Test Document")
	time.Sleep(600 * time.Millisecond)

	deleteDocument(t, v, docPath)
	time.Sleep(600 * time.Millisecond)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	assert.Contains(t, mockIdx.removed, docPath, "document should be removed from index")
}

func TestWatcher_IgnoreNonDocumentFiles(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@test-project")
	time.Sleep(200 * time.Millisecond)

	createFileInVault(t, v, "@test-project", "README.md", "# Test Project")
	createFileInVault(t, v, "@test-project", "assets/image.png", "binary data")

	time.Sleep(600 * time.Millisecond)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	assert.Empty(t, mockIdx.indexed, "non-document files should not be indexed")
}

func TestWatcher_WatchNewDirectories(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@new-project")
	time.Sleep(200 * time.Millisecond)

	docPath := createDocumentInVault(t, v, "@new-project", "New Document")
	time.Sleep(600 * time.Millisecond)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	assert.Contains(t, mockIdx.indexed, docPath, "document in new directory should be indexed")
}

func TestWatcher_GracefulShutdown(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)

	createProjectDir(t, v, "@test-project")
	time.Sleep(200 * time.Millisecond)

	createDocumentInVault(t, v, "@test-project", "Test")
	time.Sleep(100 * time.Millisecond)

	err = watcher.Stop()
	assert.NoError(t, err, "shutdown should complete without errors")
}

func TestWatcher_MultipleDocuments(t *testing.T) {
	v := createTestVault(t)
	mockIdx := &mockIndexer{}

	watcher, err := NewWatcher(v, mockIdx)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = watcher.Start(ctx)
	require.NoError(t, err)
	defer watcher.Stop()

	createProjectDir(t, v, "@project-1")
	createProjectDir(t, v, "@project-2")
	time.Sleep(200 * time.Millisecond)

	doc1 := createDocumentInVault(t, v, "@project-1", "Document 1")
	doc2 := createDocumentInVault(t, v, "@project-1", "Document 2")
	doc3 := createDocumentInVault(t, v, "@project-2", "Document 3")

	time.Sleep(1000 * time.Millisecond)

	mockIdx.mu.Lock()
	defer mockIdx.mu.Unlock()

	assert.Contains(t, mockIdx.indexed, doc1, "doc1 should be indexed")
	assert.Contains(t, mockIdx.indexed, doc2, "doc2 should be indexed")
	assert.Contains(t, mockIdx.indexed, doc3, "doc3 should be indexed")
}
