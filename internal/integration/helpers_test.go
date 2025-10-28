package integration

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"yanta/internal/asset"
	"yanta/internal/db"
	"yanta/internal/document"
	"yanta/internal/git"
	"yanta/internal/indexer"
	"yanta/internal/link"
	"yanta/internal/search"
	"yanta/internal/tag"
	"yanta/internal/vault"

	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
)

type testEnv struct {
	db             *sql.DB
	vault          *vault.Vault
	docStore       *document.Store
	ftsStore       *search.Store
	tagStore       *tag.Store
	linkStore      *link.Store
	assetStore     *asset.Store
	indexer        *indexer.Indexer
	watcher        *indexer.Watcher
	watcherStarted bool
	ctx            context.Context
	cancel         context.CancelFunc
}

func setupTestEnv(t *testing.T) *testEnv {
	dbFile := filepath.Join(t.TempDir(), "test.db")
	database, err := db.OpenDB(dbFile)
	require.NoError(t, err)

	database.SetMaxOpenConns(1)

	err = db.RunMigrations(database)
	require.NoError(t, err)

	err = seedTestProjects(database)
	require.NoError(t, err)

	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	require.NoError(t, err)

	docStore := document.NewStore(database)
	ftsStore := search.NewStore(database)
	tagStore := tag.NewStore(database)
	linkStore := link.NewStore(database)
	assetStore := asset.NewStore(database)

	idx := indexer.New(database, v, docStore, ftsStore, tagStore, linkStore, assetStore, git.NewMockSyncManager())

	watcher, err := indexer.NewWatcher(v, idx,
		indexer.WithDebounceWindow(100*time.Millisecond))
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())

	return &testEnv{
		db:         database,
		vault:      v,
		docStore:   docStore,
		ftsStore:   ftsStore,
		tagStore:   tagStore,
		linkStore:  linkStore,
		assetStore: assetStore,
		indexer:    idx,
		watcher:    watcher,
		ctx:        ctx,
		cancel:     cancel,
	}
}

func (env *testEnv) cleanup() {
	if env.watcherStarted && env.watcher != nil {
		env.watcher.Stop()
	}
	env.cancel()
	db.CloseDB(env.db)
}

func seedTestProjects(database *sql.DB) error {
	projects := []struct {
		id    string
		alias string
		name  string
	}{
		{"test-id", "@test-project", "Test Project"},
		{"lifecycle-id", "@lifecycle-test", "Lifecycle Test"},
		{"watcher-id", "@watcher-test", "Watcher Test"},
		{"bulk-id", "@bulk-test", "Bulk Test"},
		{"complex-id", "@complex-test", "Complex Test"},
		{"concurrent-id", "@concurrent-test", "Concurrent Test"},
	}

	for _, p := range projects {
		_, err := database.Exec(
			"INSERT INTO project (id, alias, name) VALUES (?, ?, ?)",
			p.id, p.alias, p.name,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func ensureProjectDir(t *testing.T, env *testEnv, projectAlias string) {
	projectPath := env.vault.ProjectPath(projectAlias)
	err := os.MkdirAll(projectPath, 0755)
	require.NoError(t, err)
}
