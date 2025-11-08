package integration

import (
	"fmt"
	"os"
	"path"
	"testing"
	"time"

	"yanta/internal/document"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegration_FullDocumentLifecycle(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	projectAlias := "@lifecycle-test"
	ensureProjectDir(t, env, projectAlias)

	docFile := document.NewDocumentFile(projectAlias, "Integration Test", []string{"test", "integration"})
	docFile.Blocks = []document.BlockNoteBlock{
		{
			ID:    "block-1",
			Type:  "heading",
			Props: map[string]any{"level": float64(1)},
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "Integration Test"},
			},
		},
		{
			ID:   "block-2",
			Type: "paragraph",
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "This document tests the full pipeline. ", Styles: map[string]any{}},
				{
					Type: "link",
					Href: "https://example.com",
					Content: []document.BlockNoteContent{
						{Type: "text", Text: "Example Link", Styles: map[string]any{}},
					},
				},
			},
		},
	}

	writer := document.NewFileWriter(env.vault)
	docPath := path.Join("projects", projectAlias, "test-doc.json")
	err := writer.WriteFile(docPath, docFile)
	require.NoError(t, err)

	err = env.indexer.IndexDocument(env.ctx, docPath)
	require.NoError(t, err)

	doc, err := env.docStore.GetByPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Equal(t, "Integration Test", doc.Title)
	assert.Equal(t, projectAlias, doc.ProjectAlias)
	assert.True(t, doc.HasLinks)

	paths, err := env.ftsStore.Search(env.ctx, "integration")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	tags, err := env.tagStore.GetByDocumentPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Len(t, tags, 2)
	tagNames := []string{tags[0].Name, tags[1].Name}
	assert.Contains(t, tagNames, "test")
	assert.Contains(t, tagNames, "integration")

	links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
	require.NoError(t, err)
	assert.Len(t, links, 1)
	assert.Equal(t, "https://example.com", links[0].URL)

	reader := document.NewFileReader(env.vault)
	docFile, err = reader.ReadFile(docPath)
	require.NoError(t, err)

	docFile.Meta.Title = "Updated Integration Test"
	docFile.Meta.Tags = []string{"updated"}
	docFile.UpdateTimestamp()

	err = writer.WriteFile(docPath, docFile)
	require.NoError(t, err)

	err = env.indexer.ReindexDocument(env.ctx, docPath)
	require.NoError(t, err)

	doc, err = env.docStore.GetByPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Equal(t, "Updated Integration Test", doc.Title)

	paths, err = env.ftsStore.Search(env.ctx, "Updated")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	tags, err = env.tagStore.GetByDocumentPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Len(t, tags, 1)
	assert.Equal(t, "updated", tags[0].Name)

	err = env.indexer.RemoveDocumentCompletely(env.ctx, docPath)
	require.NoError(t, err)

	_, err = env.docStore.GetByPath(env.ctx, docPath)
	assert.Error(t, err)

	paths, err = env.ftsStore.Search(env.ctx, "Updated")
	require.NoError(t, err)
	assert.NotContains(t, paths, docPath)
}

func TestIntegration_WatcherAutoReindex(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	err := env.watcher.Start(env.ctx)
	require.NoError(t, err)
	env.watcherStarted = true

	go func() {
		for err := range env.watcher.Errors() {
			t.Logf("Watcher error: %v", err)
		}
	}()

	projectAlias := "@watcher-test"
	ensureProjectDir(t, env, projectAlias)
	time.Sleep(200 * time.Millisecond)

	docFile := document.NewDocumentFile(projectAlias, "Watcher Test", nil)
	writer := document.NewFileWriter(env.vault)
	docPath := path.Join("projects", projectAlias, "watcher-doc.json")

	err = writer.WriteFile(docPath, docFile)
	require.NoError(t, err)

	time.Sleep(1000 * time.Millisecond)

	doc, err := env.docStore.GetByPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Equal(t, "Watcher Test", doc.Title)

	paths, err := env.ftsStore.Search(env.ctx, "Watcher")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	reader := document.NewFileReader(env.vault)
	docFile, err = reader.ReadFile(docPath)
	require.NoError(t, err)

	docFile.Meta.Title = "Modified Watcher Test"
	docFile.UpdateTimestamp()

	err = writer.WriteFile(docPath, docFile)
	require.NoError(t, err)

	time.Sleep(1000 * time.Millisecond)

	doc, err = env.docStore.GetByPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Equal(t, "Modified Watcher Test", doc.Title)

	paths, err = env.ftsStore.Search(env.ctx, "Modified")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	fullPath, err := env.vault.DocumentPath(docPath)
	require.NoError(t, err)
	err = os.Remove(fullPath)
	require.NoError(t, err)

	time.Sleep(1 * time.Second)

	_, err = env.docStore.GetByPath(env.ctx, docPath)
	assert.Error(t, err)

	paths, err = env.ftsStore.Search(env.ctx, "Modified")
	require.NoError(t, err)
	assert.NotContains(t, paths, docPath)
}

func TestIntegration_BulkIndexing(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	projectAlias := "@bulk-test"
	ensureProjectDir(t, env, projectAlias)

	docPaths := make([]string, 100)
	writer := document.NewFileWriter(env.vault)

	for i := range 100 {
		title := fmt.Sprintf("Document %d", i)
		docFile := document.NewDocumentFile(projectAlias, title, []string{"bulk"})

		docPath := path.Join("projects", projectAlias,
			fmt.Sprintf("doc-%03d.json", i))

		err := writer.WriteFile(docPath, docFile)
		require.NoError(t, err)

		docPaths[i] = docPath
	}

	for _, docPath := range docPaths {
		err := env.indexer.IndexDocument(env.ctx, docPath)
		require.NoError(t, err)
	}

	docs, err := env.docStore.Get(env.ctx, &document.GetFilters{
		ProjectAlias: &projectAlias,
	})
	require.NoError(t, err)
	assert.Len(t, docs, 100)

	paths, err := env.ftsStore.Search(env.ctx, "Document")
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(paths), 100)

	tagPaths, err := env.tagStore.GetDocumentPaths(env.ctx, "bulk")
	require.NoError(t, err)
	assert.Len(t, tagPaths, 100)
}

func TestIntegration_ComplexDocument(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	projectAlias := "@complex-test"
	ensureProjectDir(t, env, projectAlias)

	docFile := document.NewDocumentFile(projectAlias, "Complex Document",
		[]string{"complex", "test", "integration"})

	docFile.Blocks = []document.BlockNoteBlock{
		{
			ID:    "heading-1",
			Type:  "heading",
			Props: map[string]any{"level": float64(1)},
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "Main Heading"},
			},
		},
		{
			ID:   "para-1",
			Type: "paragraph",
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "Paragraph with "},
				{Type: "link", Text: "GitHub", Href: "https://github.com"},
				{Type: "text", Text: " and "},
				{Type: "link", Text: "Google", Href: "https://google.com"},
			},
		},
		{
			ID:    "code-1",
			Type:  "codeBlock",
			Props: map[string]any{"language": "go"},
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "func main() {\n\tfmt.Println(\"Hello\")\n}"},
			},
		},
		{
			ID:    "heading-2",
			Type:  "heading",
			Props: map[string]any{"level": float64(2)},
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "Subheading"},
			},
		},
		{
			ID:   "para-2",
			Type: "paragraph",
			Content: []document.BlockNoteContent{
				{Type: "text", Text: "More content here"},
			},
		},
	}

	writer := document.NewFileWriter(env.vault)
	docPath := path.Join("projects", projectAlias, "complex-doc.json")

	err := writer.WriteFile(docPath, docFile)
	require.NoError(t, err)

	err = env.indexer.IndexDocument(env.ctx, docPath)
	require.NoError(t, err)

	doc, err := env.docStore.GetByPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Equal(t, "Complex Document", doc.Title)
	assert.True(t, doc.HasCode)
	assert.True(t, doc.HasLinks)

	tags, err := env.tagStore.GetByDocumentPath(env.ctx, docPath)
	require.NoError(t, err)
	assert.Len(t, tags, 3)

	links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
	require.NoError(t, err)
	assert.Len(t, links, 2)

	linkURLs := []string{links[0].URL, links[1].URL}
	assert.Contains(t, linkURLs, "https://github.com")
	assert.Contains(t, linkURLs, "https://google.com")

	paths, err := env.ftsStore.Search(env.ctx, "Heading")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	paths, err = env.ftsStore.Search(env.ctx, "func main")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)

	paths, err = env.ftsStore.Search(env.ctx, "content")
	require.NoError(t, err)
	assert.Contains(t, paths, docPath)
}

func TestIntegration_ConcurrentIndexing(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	projectAlias := "@concurrent-test"
	ensureProjectDir(t, env, projectAlias)

	writer := document.NewFileWriter(env.vault)

	for i := range 50 {
		title := fmt.Sprintf("Concurrent Document %d", i)
		docFile := document.NewDocumentFile(projectAlias, title, nil)

		docPath := path.Join("projects", projectAlias,
			fmt.Sprintf("concurrent-%03d.json", i))

		err := writer.WriteFile(docPath, docFile)
		require.NoError(t, err)

		err = env.indexer.IndexDocument(env.ctx, docPath)
		require.NoError(t, err)
	}

	docs, err := env.docStore.Get(env.ctx, &document.GetFilters{
		ProjectAlias: &projectAlias,
	})
	require.NoError(t, err)
	assert.Len(t, docs, 50)
}
