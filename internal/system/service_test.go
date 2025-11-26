package system

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/indexer"
	"yanta/internal/link"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/tag"
	"yanta/internal/testutil"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetShutdownHandler(t *testing.T) {
	t.Run("sets shutdown handler successfully", func(t *testing.T) {
		service := NewService(nil, events.NewEventBus())

		called := false
		handler := func() {
			called = true
		}

		service.SetShutdownHandler(handler)
		assert.NotNil(t, service.shutdownHandler)

		service.shutdownHandler()
		assert.True(t, called, "shutdown handler should have been called")
	})

	t.Run("shutdown handler can be updated", func(t *testing.T) {
		service := NewService(nil, events.NewEventBus())

		firstCallCount := 0
		firstHandler := func() {
			firstCallCount++
		}

		secondCallCount := 0
		secondHandler := func() {
			secondCallCount++
		}

		service.SetShutdownHandler(firstHandler)
		service.shutdownHandler()
		assert.Equal(t, 1, firstCallCount)

		service.SetShutdownHandler(secondHandler)
		service.shutdownHandler()
		assert.Equal(t, 1, firstCallCount, "first handler should not be called again")
		assert.Equal(t, 1, secondCallCount, "second handler should be called")
	})

	t.Run("nil shutdown handler is safe", func(t *testing.T) {
		service := NewService(nil, events.NewEventBus())
		assert.Nil(t, service.shutdownHandler)

		assert.NotPanics(t, func() {
			if service.shutdownHandler != nil {
				service.shutdownHandler()
			}
		})
	})
}

func TestMigrateToGitDirectory_ShutdownHandler(t *testing.T) {
	t.Run("shutdown handler is called when set", func(t *testing.T) {
		service := NewService(nil, events.NewEventBus())

		shutdownCalled := false

		service.SetShutdownHandler(func() {
			shutdownCalled = true
		})

		assert.NotNil(t, service.shutdownHandler)

		service.shutdownHandler()

		assert.True(t, shutdownCalled)
	})

	t.Run("nil shutdown handler does not cause panic", func(t *testing.T) {
		service := NewService(nil, events.NewEventBus())

		assert.Nil(t, service.shutdownHandler)

		assert.NotPanics(t, func() {
			if service.shutdownHandler != nil {
				service.shutdownHandler()
			}
		})
	})
}

type mockGitService struct{}

func (m *mockGitService) CheckInstalled() (bool, error) {
	return true, nil
}

func (m *mockGitService) IsRepository(path string) (bool, error) {
	return false, nil
}

func (m *mockGitService) Init(path string) error {
	gitDir := filepath.Join(path, ".git")
	return os.MkdirAll(gitDir, 0755)
}

func (m *mockGitService) CreateGitIgnore(path string, patterns []string) error {
	gitignorePath := filepath.Join(path, ".gitignore")
	content := ""
	for _, pattern := range patterns {
		content += pattern + "\n"
	}
	return os.WriteFile(gitignorePath, []byte(content), 0644)
}

func (m *mockGitService) AddAll(path string) error {
	return nil
}

func (m *mockGitService) Commit(path, message string) error {
	return nil
}

func (m *mockGitService) SetRemote(path, name, url string) error {
	return nil
}

func (m *mockGitService) Push(path, remote, branch string) error {
	return nil
}

func (m *mockGitService) GetStatus(path string) (*git.Status, error) {
	return &git.Status{
		Clean:     true,
		Modified:  []string{},
		Untracked: []string{},
		Staged:    []string{},
	}, nil
}

func mustMarshalContent(content []document.BlockNoteContent) json.RawMessage {
	data, err := json.Marshal(content)
	if err != nil {
		panic(err)
	}
	return data
}

func createTestDoc(t *testing.T, v *vault.Vault, projectAlias, title string, tags []string) string {
	t.Helper()

	docFile := document.NewDocumentFile(projectAlias, title, tags)
	docFile.Blocks = []document.BlockNoteBlock{
		{
			ID:    "block-1",
			Type:  "heading",
			Props: map[string]any{"level": float64(1)},
			Content: mustMarshalContent([]document.BlockNoteContent{
				{Type: "text", Text: title},
			}),
		},
		{
			ID:   "block-2",
			Type: "paragraph",
			Content: mustMarshalContent([]document.BlockNoteContent{
				{Type: "text", Text: "Test content for " + title},
			}),
		},
	}

	writer := document.NewFileWriter(v)
	aliasSlug := strings.TrimPrefix(projectAlias, "@")
	filename := fmt.Sprintf("doc-%s-%d.json", aliasSlug, time.Now().UnixNano())
	relPath := filepath.Join("projects", projectAlias, filename)
	err := writer.WriteFile(relPath, docFile)
	require.NoError(t, err, "Failed to write test document")

	return relPath
}

func TestService_ReindexDatabase(t *testing.T) {
	t.Run("successfully reindexes entire database", func(t *testing.T) {
		db := testutil.SetupTestDB(t)
		defer testutil.CleanupTestDB(t, db)

		tempDir := t.TempDir()
		v, err := vault.New(vault.Config{RootPath: tempDir})
		require.NoError(t, err)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		_, err = db.Exec("INSERT INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test')")
		require.NoError(t, err)

		createTestDoc(t, v, "@test-project", "Doc One", []string{"tag1"})
		createTestDoc(t, v, "@test-project", "Doc Two", []string{"tag2"})

		idx := indexer.New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		service := NewService(db, events.NewEventBus())
		service.SetIndexer(idx)

		ctx := context.Background()
		err = service.ReindexDatabase(ctx)

		assert.NoError(t, err)

		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM doc").Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 2, count, "should have 2 documents indexed")

		paths, err := ftsStore.Search(ctx, "Doc")
		require.NoError(t, err)
		assert.Equal(t, 2, len(paths), "both documents should be searchable")
	})

	t.Run("handles empty vault gracefully", func(t *testing.T) {
		db := testutil.SetupTestDB(t)
		defer testutil.CleanupTestDB(t, db)

		tempDir := t.TempDir()
		v, err := vault.New(vault.Config{RootPath: tempDir})
		require.NoError(t, err)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		idx := indexer.New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		service := NewService(db, events.NewEventBus())
		service.SetIndexer(idx)

		err = service.ReindexDatabase(context.Background())
		assert.NoError(t, err)
	})

	t.Run("returns error when indexer is nil", func(t *testing.T) {
		db := testutil.SetupTestDB(t)
		defer testutil.CleanupTestDB(t, db)

		service := NewService(db, events.NewEventBus())

		err := service.ReindexDatabase(context.Background())
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "indexer not available")
	})

	t.Run("clears stale index entries before reindexing", func(t *testing.T) {
		db := testutil.SetupTestDB(t)
		defer testutil.CleanupTestDB(t, db)

		tempDir := t.TempDir()
		v, err := vault.New(vault.Config{RootPath: tempDir})
		require.NoError(t, err)

		docStore := document.NewStore(db)
		projectStore := project.NewStore(db)
		ftsStore := search.NewStore(db)
		tagStore := tag.NewStore(db)
		linkStore := link.NewStore(db)
		assetStore := asset.NewStore(db)

		_, err = db.Exec("INSERT INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test')")
		require.NoError(t, err)

		docPath := createTestDoc(t, v, "@test-project", "Will Delete", []string{"tag1"})

		idx := indexer.New(db, v, docStore, projectStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager(), events.NewEventBus())

		ctx := context.Background()
		err = idx.IndexDocument(ctx, docPath)
		require.NoError(t, err)

		fullPath, _ := v.DocumentPath(docPath)
		err = os.Remove(fullPath)
		require.NoError(t, err)

		service := NewService(db, events.NewEventBus())
		service.SetIndexer(idx)
		err = service.ReindexDatabase(ctx)
		require.NoError(t, err)

		paths, err := ftsStore.Search(ctx, "Will Delete")
		require.NoError(t, err)
		assert.Equal(t, 0, len(paths), "deleted document should not be in index")
	})

}
