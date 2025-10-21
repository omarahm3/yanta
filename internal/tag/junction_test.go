package tag

import (
	"context"
	"testing"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_AddTagsToDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	t.Run("add tags to document", func(t *testing.T) {
		err := store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing"})
		if err != nil {
			t.Fatalf("AddTagsToDocument() failed: %v", err)
		}

		tags, err := store.Get(ctx, &GetFilters{})
		if err != nil {
			t.Fatalf("Get() failed: %v", err)
		}
		if len(tags) != 2 {
			t.Errorf("expected 2 tags, got %d", len(tags))
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 2 {
			t.Errorf("expected 2 document tags, got %d", len(docTags))
		}
	})

	t.Run("add duplicate tags (no-op)", func(t *testing.T) {
		err := store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "typescript"})
		if err != nil {
			t.Fatalf("AddTagsToDocument() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 3 {
			t.Errorf("expected 3 document tags, got %d", len(docTags))
		}
	})

	t.Run("normalize tag names", func(t *testing.T) {
		_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
		_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-2.json")
		if err != nil {
			t.Fatalf("failed to create test document: %v", err)
		}

		err = store.AddTagsToDocument(ctx, "projects/@test/doc-2.json", []string{"React", "REACT", "react"})
		if err != nil {
			t.Fatalf("AddTagsToDocument() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-2.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 1 {
			t.Errorf("expected 1 document tag after normalization, got %d", len(docTags))
		}
		if docTags[0].Name != "react" {
			t.Errorf("expected tag name 'react', got '%s'", docTags[0].Name)
		}
	})

	t.Run("empty tag list (no-op)", func(t *testing.T) {
		err := store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{})
		if err != nil {
			t.Errorf("AddTagsToDocument() with empty list should not error: %v", err)
		}
	})

	t.Run("empty document path", func(t *testing.T) {
		err := store.AddTagsToDocument(ctx, "", []string{"tag1"})
		if err == nil {
			t.Error("AddTagsToDocument() with empty path should error")
		}
	})
}

func TestStore_RemoveTagsFromDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	t.Run("remove some tags", func(t *testing.T) {
		err := store.RemoveTagsFromDocument(ctx, "projects/@test/doc-1.json", []string{"testing"})
		if err != nil {
			t.Fatalf("RemoveTagsFromDocument() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 2 {
			t.Errorf("expected 2 document tags, got %d", len(docTags))
		}

		tagNames := make(map[string]bool)
		for _, tag := range docTags {
			tagNames[tag.Name] = true
		}
		if !tagNames["golang"] || !tagNames["backend"] {
			t.Error("incorrect tags removed")
		}
	})

	t.Run("remove non-existent tag (no-op)", func(t *testing.T) {
		err := store.RemoveTagsFromDocument(ctx, "projects/@test/doc-1.json", []string{"nonexistent"})
		if err != nil {
			t.Errorf("RemoveTagsFromDocument() should not error for non-existent tag: %v", err)
		}
	})

	t.Run("remove with case insensitive", func(t *testing.T) {
		err := store.RemoveTagsFromDocument(ctx, "projects/@test/doc-1.json", []string{"GOLANG"})
		if err != nil {
			t.Fatalf("RemoveTagsFromDocument() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 1 {
			t.Errorf("expected 1 document tag after removal, got %d", len(docTags))
		}
	})
}

func TestStore_ReplaceDocumentTags(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	t.Run("replace with new tags", func(t *testing.T) {
		err := store.ReplaceDocumentTags(ctx, "projects/@test/doc-1.json", []string{"typescript", "frontend"})
		if err != nil {
			t.Fatalf("ReplaceDocumentTags() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 2 {
			t.Errorf("expected 2 document tags, got %d", len(docTags))
		}

		tagNames := make(map[string]bool)
		for _, tag := range docTags {
			tagNames[tag.Name] = true
		}
		if !tagNames["typescript"] || !tagNames["frontend"] {
			t.Error("incorrect tags after replacement")
		}
		if tagNames["golang"] || tagNames["testing"] {
			t.Error("old tags should be removed")
		}
	})

	t.Run("replace with empty list", func(t *testing.T) {
		err := store.ReplaceDocumentTags(ctx, "projects/@test/doc-1.json", []string{})
		if err != nil {
			t.Fatalf("ReplaceDocumentTags() with empty list failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 0 {
			t.Errorf("expected 0 document tags after replacement with empty list, got %d", len(docTags))
		}
	})
}

func TestStore_RemoveAllDocumentTags(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	t.Run("remove all tags", func(t *testing.T) {
		err := store.RemoveAllDocumentTags(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("RemoveAllDocumentTags() failed: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 0 {
			t.Errorf("expected 0 document tags, got %d", len(docTags))
		}
	})

	t.Run("remove all on document with no tags (no-op)", func(t *testing.T) {
		err := store.RemoveAllDocumentTags(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Errorf("RemoveAllDocumentTags() should not error on empty document: %v", err)
		}
	})
}

func TestStore_GetDocumentPaths(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	docs := []string{
		"projects/@test/doc-1.json",
		"projects/@test/doc-2.json",
		"projects/@test/doc-3.json",
	}

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	for _, doc := range docs {
		_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", doc)
		if err != nil {
			t.Fatalf("failed to create test document: %v", err)
		}
	}

	err := store.AddTagsToDocument(ctx, docs[0], []string{"golang", "testing"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}
	err = store.AddTagsToDocument(ctx, docs[1], []string{"golang", "backend"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}
	err = store.AddTagsToDocument(ctx, docs[2], []string{"typescript"})
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	t.Run("get documents by tag", func(t *testing.T) {
		paths, err := store.GetDocumentPaths(ctx, "golang")
		if err != nil {
			t.Fatalf("GetDocumentPaths() failed: %v", err)
		}

		if len(paths) != 2 {
			t.Errorf("expected 2 document paths, got %d", len(paths))
		}

		pathMap := make(map[string]bool)
		for _, path := range paths {
			pathMap[path] = true
		}
		if !pathMap[docs[0]] || !pathMap[docs[1]] {
			t.Error("incorrect document paths returned")
		}
	})

	t.Run("get documents by non-existent tag", func(t *testing.T) {
		paths, err := store.GetDocumentPaths(ctx, "nonexistent")
		if err != nil {
			t.Fatalf("GetDocumentPaths() failed: %v", err)
		}

		if len(paths) != 0 {
			t.Errorf("expected 0 document paths, got %d", len(paths))
		}
	})

	t.Run("case insensitive lookup", func(t *testing.T) {
		paths, err := store.GetDocumentPaths(ctx, "GOLANG")
		if err != nil {
			t.Fatalf("GetDocumentPaths() failed: %v", err)
		}

		if len(paths) != 2 {
			t.Errorf("expected 2 document paths with case-insensitive lookup, got %d", len(paths))
		}
	})
}

func TestStore_CountDocumentTags(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	t.Run("count tags on empty document", func(t *testing.T) {
		count, err := store.CountDocumentTags(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("CountDocumentTags() failed: %v", err)
		}
		if count != 0 {
			t.Errorf("expected 0 tags, got %d", count)
		}
	})

	t.Run("count tags after adding", func(t *testing.T) {
		err := store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
		if err != nil {
			t.Fatalf("setup failed: %v", err)
		}

		count, err := store.CountDocumentTags(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("CountDocumentTags() failed: %v", err)
		}
		if count != 3 {
			t.Errorf("expected 3 tags, got %d", count)
		}
	})

	t.Run("count tags after removing", func(t *testing.T) {
		err := store.RemoveTagsFromDocument(ctx, "projects/@test/doc-1.json", []string{"testing"})
		if err != nil {
			t.Fatalf("setup failed: %v", err)
		}

		count, err := store.CountDocumentTags(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("CountDocumentTags() failed: %v", err)
		}
		if count != 2 {
			t.Errorf("expected 2 tags after removal, got %d", count)
		}
	})
}

func TestStore_JunctionTransactions(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("failed to create test document: %v", err)
	}

	t.Run("transactional add", func(t *testing.T) {
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("failed to begin transaction: %v", err)
		}

		err = store.AddTagsToDocumentTx(ctx, tx, "projects/@test/doc-1.json", []string{"golang", "testing"})
		if err != nil {
			tx.Rollback()
			t.Fatalf("AddTagsToDocumentTx() failed: %v", err)
		}

		if err := tx.Commit(); err != nil {
			t.Fatalf("failed to commit: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}
		if len(docTags) != 2 {
			t.Errorf("expected 2 tags after commit, got %d", len(docTags))
		}
	})

	t.Run("transactional rollback", func(t *testing.T) {
		tx, err := db.Begin()
		if err != nil {
			t.Fatalf("failed to begin transaction: %v", err)
		}

		err = store.AddTagsToDocumentTx(ctx, tx, "projects/@test/doc-1.json", []string{"rollback-tag"})
		if err != nil {
			tx.Rollback()
			t.Fatalf("AddTagsToDocumentTx() failed: %v", err)
		}

		if err := tx.Rollback(); err != nil {
			t.Fatalf("failed to rollback: %v", err)
		}

		docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
		if err != nil {
			t.Fatalf("GetByDocumentPath() failed: %v", err)
		}

		for _, tag := range docTags {
			if tag.Name == "rollback-tag" {
				t.Error("rollback-tag should not exist after rollback")
			}
		}
	})
}

func TestNormalizeTags(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "lowercase conversion",
			input:    []string{"Golang", "REACT", "TypeScript"},
			expected: []string{"golang", "react", "typescript"},
		},
		{
			name:     "remove duplicates",
			input:    []string{"golang", "golang", "react"},
			expected: []string{"golang", "react"},
		},
		{
			name:     "case-insensitive deduplication",
			input:    []string{"Golang", "golang", "GOLANG"},
			expected: []string{"golang"},
		},
		{
			name:     "trim whitespace",
			input:    []string{"  golang  ", "react", " typescript "},
			expected: []string{"golang", "react", "typescript"},
		},
		{
			name:     "filter empty strings",
			input:    []string{"golang", "", "  ", "react"},
			expected: []string{"golang", "react"},
		},
		{
			name:     "empty input",
			input:    []string{},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeTags(tt.input)

			if len(result) != len(tt.expected) {
				t.Errorf("expected %d tags, got %d", len(tt.expected), len(result))
				return
			}

			for i, tag := range result {
				if tag != tt.expected[i] {
					t.Errorf("at index %d: expected '%s', got '%s'", i, tt.expected[i], tag)
				}
			}
		})
	}
}

func TestStore_AddTagsToDocumentTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	err = store.AddTagsToDocumentTx(ctx, tx, "projects/@test/doc-1.json", []string{"golang", "testing"})
	require.NoError(t, err)

	err = tx.Commit()
	require.NoError(t, err)

	docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
	require.NoError(t, err)
	assert.Len(t, docTags, 2)
}

func TestStore_RemoveTagsFromDocumentTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	require.NoError(t, err)

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	err = store.RemoveTagsFromDocumentTx(ctx, tx, "projects/@test/doc-1.json", []string{"testing"})
	require.NoError(t, err)

	err = tx.Commit()
	require.NoError(t, err)

	docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
	require.NoError(t, err)
	assert.Len(t, docTags, 2)
}

func TestStore_ReplaceDocumentTagsTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	require.NoError(t, err)

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing"})
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	err = store.ReplaceDocumentTagsTx(ctx, tx, "projects/@test/doc-1.json", []string{"typescript", "frontend"})
	require.NoError(t, err)

	err = tx.Commit()
	require.NoError(t, err)

	docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
	require.NoError(t, err)
	assert.Len(t, docTags, 2)

	tagNames := make(map[string]bool)
	for _, tag := range docTags {
		tagNames[tag.Name] = true
	}
	assert.True(t, tagNames["typescript"])
	assert.True(t, tagNames["frontend"])
	assert.False(t, tagNames["golang"])
	assert.False(t, tagNames["testing"])
}

func TestStore_RemoveAllDocumentTagsTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	require.NoError(t, err)

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	err = store.RemoveAllDocumentTagsTx(ctx, tx, "projects/@test/doc-1.json")
	require.NoError(t, err)

	err = tx.Commit()
	require.NoError(t, err)

	docTags, err := store.GetByDocumentPath(ctx, "projects/@test/doc-1.json")
	require.NoError(t, err)
	assert.Len(t, docTags, 0)
}

func TestStore_GetDocumentPathsTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	docs := []string{
		"projects/@test/doc-1.json",
		"projects/@test/doc-2.json",
	}

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	for _, doc := range docs {
		_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", doc)
		require.NoError(t, err)
	}

	err := store.AddTagsToDocument(ctx, docs[0], []string{"golang"})
	require.NoError(t, err)
	err = store.AddTagsToDocument(ctx, docs[1], []string{"golang"})
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	paths, err := store.GetDocumentPathsTx(ctx, tx, "golang")
	require.NoError(t, err)
	assert.Len(t, paths, 2)

	err = tx.Commit()
	require.NoError(t, err)
}

func TestStore_CountDocumentTagsTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)
	store := NewStore(db)
	ctx := context.Background()

	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')`)
	_, err := db.Exec("INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)", "projects/@test/doc-1.json")
	require.NoError(t, err)

	err = store.AddTagsToDocument(ctx, "projects/@test/doc-1.json", []string{"golang", "testing", "backend"})
	require.NoError(t, err)

	tx, err := db.Begin()
	require.NoError(t, err)
	defer tx.Rollback()

	count, err := store.CountDocumentTagsTx(ctx, tx, "projects/@test/doc-1.json")
	require.NoError(t, err)
	assert.Equal(t, 3, count)

	err = tx.Commit()
	require.NoError(t, err)
}
