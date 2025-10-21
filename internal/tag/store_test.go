package tag

import (
	"context"
	"strings"
	"testing"
	"time"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testProjectAlias = "@test-project"

func setupStoreTest(t *testing.T) (*Store, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)

	ctx := context.Background()
	_, err := database.ExecContext(ctx, `
		INSERT INTO project (id, alias, name, start_date, end_date, created_at, updated_at)
		VALUES ('test-project-id', ?, 'Test Project', '2024-01-01', '2024-12-31', 
		        strftime('%Y-%m-%d %H:%M:%f', 'now'), strftime('%Y-%m-%d %H:%M:%f', 'now'))
	`, testProjectAlias)
	if err != nil {
		t.Fatalf("Failed to create test project: %v", err)
	}

	_, err = database.ExecContext(ctx, `
		INSERT INTO doc (path, project_alias, title, mtime_ns, size_bytes, has_code, has_images, has_links, created_at, updated_at)
		VALUES ('test-doc.md', ?, 'Test Document', 1640995200000000000, 1024, 1, 1, 1,
		        strftime('%Y-%m-%d %H:%M:%f', 'now'), strftime('%Y-%m-%d %H:%M:%f', 'now'))
	`, testProjectAlias)
	if err != nil {
		t.Fatalf("Failed to create test document: %v", err)
	}

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return store, cleanup
}

func TestStore_Create(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tests := []struct {
		name        string
		tagName     string
		wantError   bool
		description string
	}{
		{
			name:        "create tag with valid name",
			tagName:     "test-tag",
			wantError:   false,
			description: "Should create tag with valid name",
		},
		{
			name:        "create tag with uppercase name",
			tagName:     "UPPERCASE-TAG",
			wantError:   false,
			description: "Should create tag with uppercase name (normalized to lowercase)",
		},
		{
			name:        "create tag with mixed case name",
			tagName:     "MixedCase-Tag",
			wantError:   false,
			description: "Should create tag with mixed case name (normalized to lowercase)",
		},
		{
			name:        "create tag with special characters",
			tagName:     "tag_with_underscores",
			wantError:   false,
			description: "Should create tag with underscores",
		},
		{
			name:        "create tag with hyphens",
			tagName:     "tag-with-hyphens",
			wantError:   false,
			description: "Should create tag with hyphens",
		},
		{
			name:        "create tag with numbers",
			tagName:     "tag123",
			wantError:   false,
			description: "Should create tag with numbers",
		},
		{
			name:        "create tag with empty name",
			tagName:     "",
			wantError:   true,
			description: "Should error when creating tag with empty name",
		},
		{
			name:        "create tag with too long name",
			tagName:     string(make([]byte, 65)), // 65 characters, exceeds limit of 64
			wantError:   true,
			description: "Should error when creating tag with name too long",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var tag *Tag
			if tt.tagName == "" {
				tag = nil
			} else {
				var err error
				tag, err = New(tt.tagName)
				if tt.wantError && err != nil {
					// Expected error during tag creation
					return
				}
				require.NoError(t, err)
			}

			result, err := store.Create(ctx, tag)

			if tt.wantError {
				assert.Error(t, err, "Create() expected error but got none")
				return
			}

			require.NoError(t, err, "Create() unexpected error: %v", err)
			require.NotNil(t, result, "Create() returned nil tag")

			retrieved, err := store.GetByName(ctx, result.Name)
			require.NoError(t, err, "GetByName() failed to retrieve created tag")

			expectedName := strings.ToLower(tt.tagName)
			assert.Equal(t, expectedName, retrieved.Name, "Tag name should be normalized to lowercase")
			assert.Equal(t, expectedName, result.Name, "Returned tag name should be normalized to lowercase")

			assert.NotEmpty(t, retrieved.CreatedAt, "CreatedAt should not be empty")
			assert.NotEmpty(t, retrieved.UpdatedAt, "UpdatedAt should not be empty")
			assert.Empty(t, retrieved.DeletedAt, "DeletedAt should be empty for new tag")
		})
	}
}

func TestStore_CreateTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create tag within transaction", func(t *testing.T) {
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		tag, err := New("transaction-tag")
		require.NoError(t, err)

		result, err := store.CreateTx(ctx, tx, tag)
		require.NoError(t, err, "CreateTx() failed")
		require.NotNil(t, result, "CreateTx() returned nil tag")

		err = tx.Commit()
		require.NoError(t, err, "Failed to commit transaction")

		retrieved, err := store.GetByName(ctx, result.Name)
		require.NoError(t, err, "GetByName() failed to retrieve tag after transaction commit")
		assert.Equal(t, "transaction-tag", retrieved.Name)
	})

	t.Run("rollback transaction", func(t *testing.T) {
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		tag, err := New("rollback-tag")
		require.NoError(t, err)

		result, err := store.CreateTx(ctx, tx, tag)
		require.NoError(t, err, "CreateTx() failed")

		err = tx.Rollback()
		require.NoError(t, err, "Failed to rollback transaction")

		_, err = store.GetByName(ctx, result.Name)
		assert.Error(t, err, "GetByName() should have failed after transaction rollback")
	})
}

func TestStore_GetByName(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("get-test-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create test tag")

	tests := []struct {
		name        string
		tagName     string
		wantError   bool
		description string
	}{
		{
			name:        "get existing tag",
			tagName:     created.Name,
			wantError:   false,
			description: "Should retrieve existing tag",
		},
		{
			name:        "get existing tag with different case",
			tagName:     "GET-TEST-TAG",
			wantError:   false,
			description: "Should retrieve existing tag with different case",
		},
		{
			name:        "get non-existent tag",
			tagName:     "non-existent-tag",
			wantError:   true,
			description: "Should error when getting non-existent tag",
		},
		{
			name:        "get soft deleted tag",
			tagName:     created.Name,
			wantError:   true,
			description: "Should error when getting soft deleted tag",
		},
	}

	t.Run(tests[0].name, func(t *testing.T) {
		result, err := store.GetByName(ctx, tests[0].tagName)

		if tests[0].wantError {
			assert.Error(t, err, "GetByName() expected error but got none")
			return
		}

		require.NoError(t, err, "GetByName() unexpected error: %v", err)
		require.NotNil(t, result, "GetByName() returned nil tag")

		assert.Equal(t, created.Name, result.Name, "Tag name mismatch")
		assert.NotEmpty(t, result.CreatedAt, "CreatedAt should not be empty")
		assert.NotEmpty(t, result.UpdatedAt, "UpdatedAt should not be empty")
		assert.Empty(t, result.DeletedAt, "DeletedAt should be empty")
	})

	t.Run(tests[1].name, func(t *testing.T) {
		_, err := store.GetByName(ctx, tests[1].tagName)

		if !tests[1].wantError {
			assert.NoError(t, err, "GetByName() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByName() expected error but got none")
	})

	err = store.SoftDelete(ctx, created.Name)
	require.NoError(t, err, "Failed to soft delete tag")

	t.Run(tests[2].name, func(t *testing.T) {
		_, err := store.GetByName(ctx, tests[2].tagName)

		if !tests[2].wantError {
			assert.NoError(t, err, "GetByName() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByName() expected error but got none")
	})
}

func TestStore_GetByNameTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("get-tx-test-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create test tag")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	result, err := store.GetByNameTx(ctx, tx, created.Name)
	require.NoError(t, err, "GetByNameTx() failed")
	require.NotNil(t, result, "GetByNameTx() returned nil tag")

	assert.Equal(t, created.Name, result.Name, "Tag name mismatch")
	assert.NotEmpty(t, result.CreatedAt, "CreatedAt should not be empty")
	assert.NotEmpty(t, result.UpdatedAt, "UpdatedAt should not be empty")
	assert.Empty(t, result.DeletedAt, "DeletedAt should be empty")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_Get(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag1, err := New("alpha-tag")
	require.NoError(t, err)
	tag2, err := New("beta-tag")
	require.NoError(t, err)
	tag3, err := New("gamma-tag")
	require.NoError(t, err)

	_, err = store.Create(ctx, tag1)
	require.NoError(t, err, "Failed to create tag 1")

	time.Sleep(10 * time.Millisecond) // Ensure different timestamps

	created2, err := store.Create(ctx, tag2)
	require.NoError(t, err, "Failed to create tag 2")

	time.Sleep(10 * time.Millisecond)

	_, err = store.Create(ctx, tag3)
	require.NoError(t, err, "Failed to create tag 3")

	tests := []struct {
		name        string
		filters     *GetFilters
		wantCount   int
		description string
	}{
		{
			name: "get all tags",
			filters: &GetFilters{
				IncludeDeleted: false,
			},
			wantCount:   3,
			description: "Should return all active tags",
		},
		{
			name: "get tags by name like",
			filters: &GetFilters{
				NameLike:       stringPtr("beta"),
				IncludeDeleted: false,
			},
			wantCount:   1,
			description: "Should return tags with matching name",
		},
		{
			name: "get tags by name like (case insensitive)",
			filters: &GetFilters{
				NameLike:       stringPtr("ALPHA"),
				IncludeDeleted: false,
			},
			wantCount:   1,
			description: "Should return tags with matching name (case insensitive)",
		},
		{
			name: "get tags including deleted",
			filters: &GetFilters{
				IncludeDeleted: true,
			},
			wantCount:   3,
			description: "Should return all tags including deleted",
		},
		{
			name: "get tags with no matches",
			filters: &GetFilters{
				NameLike:       stringPtr("non-existent"),
				IncludeDeleted: false,
			},
			wantCount:   0,
			description: "Should return empty list for no matches",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tags, err := store.Get(ctx, tt.filters)
			require.NoError(t, err, "Get() failed: %v", err)
			assert.Len(t, tags, tt.wantCount, "Get() returned wrong number of tags")

			if len(tags) > 1 {
				for i := 1; i < len(tags); i++ {
					assert.True(t, tags[i-1].Name <= tags[i].Name,
						"Tags should be ordered by name ASC")
				}
			}
		})
	}

	err = store.SoftDelete(ctx, created2.Name)
	require.NoError(t, err, "Failed to soft delete tag 2")

	t.Run("get tags excluding deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: false,
		}
		tags, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, tags, 2, "Should exclude soft deleted tag")

		for _, tag := range tags {
			assert.NotEqual(t, created2.Name, tag.Name, "Should not include soft deleted tag")
		}
	})

	t.Run("get tags including deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: true,
		}
		tags, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, tags, 3, "Should include soft deleted tag")
	})
}

func TestStore_GetTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag1, err := New("get-tx-tag1")
	require.NoError(t, err)
	tag2, err := New("get-tx-tag2")
	require.NoError(t, err)
	tag3, err := New("get-tx-tag3")
	require.NoError(t, err)

	_, err = store.Create(ctx, tag1)
	require.NoError(t, err, "Failed to create tag 1")

	time.Sleep(10 * time.Millisecond)

	_, err = store.Create(ctx, tag2)
	require.NoError(t, err, "Failed to create tag 2")

	time.Sleep(10 * time.Millisecond)

	_, err = store.Create(ctx, tag3)
	require.NoError(t, err, "Failed to create tag 3")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	filters := &GetFilters{
		IncludeDeleted: false,
	}

	tags, err := store.GetTx(ctx, tx, filters)
	require.NoError(t, err, "GetTx() failed")
	require.Len(t, tags, 3, "Should return 3 tags")

	assert.Equal(t, "get-tx-tag1", tags[0].Name, "First tag name mismatch")
	assert.Equal(t, "get-tx-tag2", tags[1].Name, "Second tag name mismatch")
	assert.Equal(t, "get-tx-tag3", tags[2].Name, "Third tag name mismatch")

	nameLike := "tag2"
	filtersWithName := &GetFilters{
		NameLike:       &nameLike,
		IncludeDeleted: false,
	}

	filteredTags, err := store.GetTx(ctx, tx, filtersWithName)
	require.NoError(t, err, "GetTx() with name filter failed")
	require.Len(t, filteredTags, 1, "Should return 1 filtered tag")
	assert.Equal(t, "get-tx-tag2", filteredTags[0].Name, "Filtered tag name mismatch")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_SoftDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-delete-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for delete test")

	tests := []struct {
		name        string
		tagName     string
		wantError   bool
		description string
	}{
		{
			name:        "delete existing tag",
			tagName:     created.Name,
			wantError:   false,
			description: "Should soft delete existing tag",
		},
		{
			name:        "delete non-existent tag",
			tagName:     "non-existent-tag",
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting non-existent tag",
		},
		{
			name:        "delete already deleted tag",
			tagName:     created.Name,
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting already deleted tag",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.SoftDelete(ctx, tt.tagName)

			if tt.wantError {
				assert.Error(t, err, "SoftDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "SoftDelete() unexpected error: %v", err)

			if tt.tagName == created.Name && tt.name == "delete existing tag" {
				_, err := store.GetByName(ctx, tt.tagName)
				assert.Error(t, err, "GetByName() should have failed for soft deleted tag")

				tags, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, tag := range tags {
					assert.NotEqual(t, tt.tagName, tag.Name, "Soft deleted tag should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_SoftDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-delete-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for delete test")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.SoftDeleteTx(ctx, tx, created.Name)
	require.NoError(t, err, "SoftDeleteTx() failed")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	_, err = store.GetByName(ctx, created.Name)
	assert.Error(t, err, "GetByName() should have failed for soft deleted tag")
}

func TestStore_Restore(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-restore-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for restore test")

	err = store.SoftDelete(ctx, created.Name)
	require.NoError(t, err, "Failed to soft delete tag")

	tests := []struct {
		name        string
		tagName     string
		wantError   bool
		description string
	}{
		{
			name:        "restore deleted tag",
			tagName:     created.Name,
			wantError:   false,
			description: "Should restore soft deleted tag",
		},
		{
			name:        "restore non-existent tag",
			tagName:     "non-existent-tag",
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring non-existent tag",
		},
		{
			name:        "restore already active tag",
			tagName:     created.Name,
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring already active tag",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.Restore(ctx, tt.tagName)

			if tt.wantError {
				assert.Error(t, err, "Restore() expected error but got none")
				return
			}

			require.NoError(t, err, "Restore() unexpected error: %v", err)

			if tt.tagName == created.Name && tt.name == "restore deleted tag" {
				retrieved, err := store.GetByName(ctx, tt.tagName)
				require.NoError(t, err, "GetByName() failed to retrieve restored tag")
				assert.Equal(t, "to-restore-tag", retrieved.Name)

				tags, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				found := false
				for _, tag := range tags {
					if tag.Name == tt.tagName {
						found = true
						break
					}
				}
				assert.True(t, found, "Restored tag should appear in Get results")
			}
		})
	}
}

func TestStore_RestoreTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-restore-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for restore test")

	err = store.SoftDelete(ctx, created.Name)
	require.NoError(t, err, "Failed to soft delete tag")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.RestoreTx(ctx, tx, created.Name)
	require.NoError(t, err, "RestoreTx() failed")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	retrieved, err := store.GetByName(ctx, created.Name)
	require.NoError(t, err, "GetByName() failed to retrieve restored tag")
	assert.Equal(t, "to-restore-tag", retrieved.Name)
}

func TestStore_HardDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-hard-delete-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for hard delete test")

	tests := []struct {
		name        string
		tagName     string
		wantError   bool
		description string
	}{
		{
			name:        "hard delete existing tag",
			tagName:     created.Name,
			wantError:   false,
			description: "Should hard delete existing tag",
		},
		{
			name:        "hard delete non-existent tag",
			tagName:     "non-existent-tag",
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting non-existent tag",
		},
		{
			name:        "hard delete already deleted tag",
			tagName:     created.Name,
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting already deleted tag",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.HardDelete(ctx, tt.tagName)

			if tt.wantError {
				assert.Error(t, err, "HardDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "HardDelete() unexpected error: %v", err)

			if tt.tagName == created.Name && tt.name == "hard delete existing tag" {
				_, err := store.GetByName(ctx, tt.tagName)
				assert.Error(t, err, "GetByName() should have failed for hard deleted tag")

				tags, err := store.Get(ctx, &GetFilters{IncludeDeleted: true})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, tag := range tags {
					assert.NotEqual(t, tt.tagName, tag.Name, "Hard deleted tag should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_HardDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("to-hard-delete-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for hard delete test")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.HardDeleteTx(ctx, tx, created.Name)
	require.NoError(t, err, "HardDeleteTx() failed")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	_, err = store.GetByName(ctx, created.Name)
	assert.Error(t, err, "GetByName() should have failed for hard deleted tag")
}

func TestStore_GetByDocumentPath(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag1, err := New("tag1")
	require.NoError(t, err)
	tag2, err := New("tag2")
	require.NoError(t, err)
	tag3, err := New("tag3")
	require.NoError(t, err)

	_, err = store.Create(ctx, tag1)
	require.NoError(t, err, "Failed to create tag1")

	_, err = store.Create(ctx, tag2)
	require.NoError(t, err, "Failed to create tag2")

	_, err = store.Create(ctx, tag3)
	require.NoError(t, err, "Failed to create tag3")

	db := store.db
	_, err = db.ExecContext(ctx, `
		INSERT INTO doc_tag (path, tag) VALUES 
		('test-doc.md', 'tag1'),
		('test-doc.md', 'tag2')
	`)
	require.NoError(t, err, "Failed to create document-tag relationships")

	tests := []struct {
		name         string
		documentPath string
		wantCount    int
		description  string
	}{
		{
			name:         "get tags for document with tags",
			documentPath: "test-doc.md",
			wantCount:    2,
			description:  "Should return tags associated with document",
		},
		{
			name:         "get tags for document without tags",
			documentPath: "no-tags-doc.md",
			wantCount:    0,
			description:  "Should return empty list for document without tags",
		},
		{
			name:         "get tags for non-existent document",
			documentPath: "non-existent.md",
			wantCount:    0,
			description:  "Should return empty list for non-existent document",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tags, err := store.GetByDocumentPath(ctx, tt.documentPath)
			require.NoError(t, err, "GetByDocumentPath() failed: %v", err)
			assert.Len(t, tags, tt.wantCount, "GetByDocumentPath() returned wrong number of tags")

			if len(tags) > 1 {
				for i := 1; i < len(tags); i++ {
					assert.True(t, tags[i-1].Name <= tags[i].Name,
						"Tags should be ordered by name ASC")
				}
			}
		})
	}

	err = store.SoftDelete(ctx, "tag1")
	require.NoError(t, err, "Failed to soft delete tag1")

	t.Run("get tags excluding soft deleted", func(t *testing.T) {
		tags, err := store.GetByDocumentPath(ctx, "test-doc.md")
		require.NoError(t, err, "GetByDocumentPath() failed: %v", err)
		assert.Len(t, tags, 1, "Should exclude soft deleted tag")

		assert.Equal(t, "tag2", tags[0].Name, "Should only return active tag")
	})
}

func TestStore_GetByDocumentPathTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag1, err := New("doc-tx-tag1")
	require.NoError(t, err)
	tag2, err := New("doc-tx-tag2")
	require.NoError(t, err)

	_, err = store.Create(ctx, tag1)
	require.NoError(t, err, "Failed to create tag1")

	_, err = store.Create(ctx, tag2)
	require.NoError(t, err, "Failed to create tag2")

	_, err = store.db.ExecContext(ctx, `
		INSERT INTO doc_tag (path, tag)
		VALUES ('test-doc.md', 'doc-tx-tag1'), ('test-doc.md', 'doc-tx-tag2')
	`)
	require.NoError(t, err, "Failed to create doc-tag relationships")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	tags, err := store.GetByDocumentPathTx(ctx, tx, "test-doc.md")
	require.NoError(t, err, "GetByDocumentPathTx() failed")
	require.Len(t, tags, 2, "Should return 2 tags")

	assert.Equal(t, "doc-tx-tag1", tags[0].Name, "First tag name mismatch")
	assert.Equal(t, "doc-tx-tag2", tags[1].Name, "Second tag name mismatch")

	emptyTags, err := store.GetByDocumentPathTx(ctx, tx, "non-existent-doc.md")
	require.NoError(t, err, "GetByDocumentPathTx() failed for non-existent doc")
	assert.Len(t, emptyTags, 0, "Should return empty list for non-existent document")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_EdgeCases(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create tag with maximum length name", func(t *testing.T) {
		maxName := string(make([]byte, 64)) // 64 characters, maximum allowed
		for i := range maxName {
			maxName = maxName[:i] + "a" + maxName[i+1:]
		}

		tag, err := New(maxName)
		require.NoError(t, err)
		created, err := store.Create(ctx, tag)
		require.NoError(t, err, "Create() with max length name failed: %v", err)

		retrieved, err := store.GetByName(ctx, created.Name)
		require.NoError(t, err, "GetByName() failed for max length name tag: %v", err)
		assert.Len(t, retrieved.Name, 64, "Tag name length mismatch")
	})

	t.Run("create tag with unicode characters", func(t *testing.T) {
		unicodeName := "tag_with_unicode_chars"
		tag, err := New(unicodeName)
		require.NoError(t, err)
		created, err := store.Create(ctx, tag)
		require.NoError(t, err, "Create() with unicode characters failed: %v", err)

		retrieved, err := store.GetByName(ctx, created.Name)
		require.NoError(t, err, "GetByName() failed for unicode tag: %v", err)
		assert.Equal(t, strings.ToLower(unicodeName), retrieved.Name, "Tag name mismatch")
	})

	t.Run("create tag with numbers and special chars", func(t *testing.T) {
		specialName := "tag_123-with_456_789"
		tag, err := New(specialName)
		require.NoError(t, err)
		created, err := store.Create(ctx, tag)
		require.NoError(t, err, "Create() with numbers and special chars failed: %v", err)

		retrieved, err := store.GetByName(ctx, created.Name)
		require.NoError(t, err, "GetByName() failed for special chars tag: %v", err)
		assert.Equal(t, strings.ToLower(specialName), retrieved.Name, "Tag name mismatch")
	})

	t.Run("duplicate tag creation", func(t *testing.T) {
		tag1, err := New("duplicate-tag")
		require.NoError(t, err)
		tag2, err := New("duplicate-tag")
		require.NoError(t, err)

		_, err = store.Create(ctx, tag1)
		require.NoError(t, err, "Failed to create first tag")

		_, err = store.Create(ctx, tag2)
		assert.Error(t, err, "Should error when creating duplicate tag")
	})

	t.Run("case insensitive duplicate tag creation", func(t *testing.T) {
		tag1, err := New("case-tag")
		require.NoError(t, err)
		tag2, err := New("CASE-TAG")
		require.NoError(t, err)

		_, err = store.Create(ctx, tag1)
		require.NoError(t, err, "Failed to create first tag")

		_, err = store.Create(ctx, tag2)
		assert.Error(t, err, "Should error when creating case-insensitive duplicate tag")
	})
}

func TestStore_ConcurrentAccess(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	const numGoroutines = 10
	results := make(chan string, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			maxRetries := 10
			for attempt := 0; attempt < maxRetries; attempt++ {
				tagName := "concurrent-tag-" + string(rune('A'+i))
				tag, err := New(tagName)
				require.NoError(t, err)

				created, err := store.Create(ctx, tag)
				if err != nil {
					if attempt < maxRetries-1 {
						time.Sleep(time.Millisecond * 10)
						continue
					}
					errors <- err
					return
				}

				results <- created.Name
				return
			}
		}(i)
	}

	var names []string
	for i := 0; i < numGoroutines; i++ {
		select {
		case name := <-results:
			names = append(names, name)
		case err := <-errors:
			t.Errorf("Concurrent create failed: %v", err)
		}
	}

	assert.Len(t, names, numGoroutines, "Expected %d concurrent creates, got %d", numGoroutines, len(names))

	tags, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
	require.NoError(t, err, "Get() failed: %v", err)
	assert.GreaterOrEqual(t, len(tags), numGoroutines, "Expected at least %d tags in Get results", numGoroutines)
}

func TestStore_ContextCancellation(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	tag, err := New("cancelled-tag")
	require.NoError(t, err)

	_, err = store.Create(ctx, tag)
	assert.Error(t, err, "Create() with cancelled context should have failed")

	ctx, cancel = context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()
	time.Sleep(1 * time.Millisecond) // Ensure timeout

	_, err = store.Create(ctx, tag)
	assert.Error(t, err, "Create() with timeout context should have failed")
}

func TestStore_TransactionIsolation(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tag, err := New("isolation-test-tag")
	require.NoError(t, err)
	created, err := store.Create(ctx, tag)
	require.NoError(t, err, "Failed to create tag for isolation test")

	db := store.db
	tx1, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 1")
	defer tx1.Rollback()

	err = store.SoftDeleteTx(ctx, tx1, created.Name)
	require.NoError(t, err, "SoftDeleteTx() failed")

	tx2, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 2")
	defer tx2.Rollback()

	tempStore := &Store{db: db}

	retrieved, err := tempStore.GetByName(ctx, created.Name)
	require.NoError(t, err, "GetByName() failed")
	assert.Equal(t, "isolation-test-tag", retrieved.Name, "Should see tag before soft delete commit")

	err = tx1.Commit()
	require.NoError(t, err, "Failed to commit transaction 1")

	retrieved, err = tempStore.GetByName(ctx, created.Name)
	assert.Error(t, err, "Should not find soft deleted tag after commit")

	err = tx2.Commit()
	require.NoError(t, err, "Failed to commit transaction 2")
}

func TestStore_NewStore(t *testing.T) {
	database := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, database)

	store := NewStore(database)

	assert.NotNil(t, store, "Store should not be nil")
	assert.Equal(t, database, store.db, "Database should be set correctly")
}

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
