package document

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testProjectAlias = "@test-project"

func docPath(alias, suffix string) string {
	return fmt.Sprintf("projects/%s/%s", alias, strings.TrimPrefix(suffix, "/"))
}

// setupStoreTest creates a test database and store instance
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
		document    *Document
		wantError   bool
		description string
	}{
		{
			name: "create document with all fields",
			document: New(docPath(testProjectAlias, "path/to/document.json"), testProjectAlias, "Test Document",
				WithModificationTime(1640995200000000000), // 2022-01-01 00:00:00 UTC in nanoseconds
				WithSize(1024),
				WithMetadata(true, true, true),
			),
			wantError:   false,
			description: "Should create document with all fields provided",
		},
		{
			name:        "create document with minimal fields",
			document:    New(docPath(testProjectAlias, "minimal/path.json"), testProjectAlias, "Minimal Document"),
			wantError:   false,
			description: "Should create document with only required fields",
		},
		{
			name:        "create document with nil document",
			document:    nil,
			wantError:   true,
			description: "Should error when document is nil",
		},
		{
			name:        "create document with empty path",
			document:    New("", testProjectAlias, "Empty Path Document"),
			wantError:   true,
			description: "Should error when path is empty",
		},
		{
			name:        "create document with special characters in path",
			document:    New(docPath(testProjectAlias, "path/with spaces & special-chars.json"), testProjectAlias, "Special Path Document"),
			wantError:   false,
			description: "Should create document with special characters in path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := store.Create(ctx, tt.document)

			if tt.wantError {
				assert.Error(t, err, "Create() expected error but got none")
				return
			}

			require.NoError(t, err, "Create() unexpected error: %v", err)
			require.NotNil(t, result, "Create() returned nil document")

			// Verify the document was created correctly
			retrieved, err := store.GetByPath(ctx, result.Path)
			require.NoError(t, err, "GetByPath() failed to retrieve created document")

			assert.Equal(t, tt.document.Path, retrieved.Path, "Document path mismatch")
			assert.Equal(t, tt.document.ProjectAlias, retrieved.ProjectAlias, "Document project_alias mismatch")
			assert.Equal(t, tt.document.Title, retrieved.Title, "Document title mismatch")
			assert.Equal(t, tt.document.ModificationTime, retrieved.ModificationTime, "Document mtime_ns mismatch")
			assert.Equal(t, tt.document.Size, retrieved.Size, "Document size_bytes mismatch")
			assert.Equal(t, tt.document.HasCode, retrieved.HasCode, "Document has_code mismatch")
			assert.Equal(t, tt.document.HasImages, retrieved.HasImages, "Document has_images mismatch")
			assert.Equal(t, tt.document.HasLinks, retrieved.HasLinks, "Document has_links mismatch")

			// Verify timestamps are set
			assert.NotEmpty(t, retrieved.CreatedAt, "CreatedAt should not be empty")
			assert.NotEmpty(t, retrieved.UpdatedAt, "UpdatedAt should not be empty")
		})
	}
}

func TestStore_CreateTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create document within transaction", func(t *testing.T) {
		// Get the underlying database connection
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		document := New(docPath(testProjectAlias, "tx/document.json"), testProjectAlias, "Transaction Document",
			WithModificationTime(1640995200000000000),
			WithSize(2048),
			WithMetadata(false, true, false),
		)

		result, err := store.CreateTx(ctx, tx, document)
		require.NoError(t, err, "CreateTx() failed")
		require.NotNil(t, result, "CreateTx() returned nil document")

		// Commit transaction
		err = tx.Commit()
		require.NoError(t, err, "Failed to commit transaction")

		// Verify document exists after commit
		retrieved, err := store.GetByPath(ctx, result.Path)
		require.NoError(t, err, "GetByPath() failed to retrieve document after transaction commit")
		assert.Equal(t, "Transaction Document", retrieved.Title)
	})

	t.Run("rollback transaction", func(t *testing.T) {
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		document := New(docPath(testProjectAlias, "rollback/document.json"), testProjectAlias, "Rollback Document")

		result, err := store.CreateTx(ctx, tx, document)
		require.NoError(t, err, "CreateTx() failed")

		// Rollback transaction
		err = tx.Rollback()
		require.NoError(t, err, "Failed to rollback transaction")

		// Verify document does not exist after rollback
		_, err = store.GetByPath(ctx, result.Path)
		assert.Error(t, err, "GetByPath() should have failed after transaction rollback")
	})
}

func TestStore_GetByPath(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test document first
	document := New(docPath(testProjectAlias, "get/test/document.json"), testProjectAlias, "Get Test Document",
		WithModificationTime(1640995200000000000),
		WithSize(512),
		WithMetadata(true, false, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create test document")

	tests := []struct {
		name        string
		path        string
		wantError   bool
		description string
	}{
		{
			name:        "get existing document",
			path:        created.Path,
			wantError:   false,
			description: "Should retrieve existing document",
		},
		{
			name:        "get non-existent document",
			path:        "/non/existent/path.json",
			wantError:   true,
			description: "Should error when getting non-existent document",
		},
		{
			name:        "get soft deleted document",
			path:        created.Path,
			wantError:   true,
			description: "Should error when getting soft deleted document",
		},
	}

	// Test getting existing document
	t.Run(tests[0].name, func(t *testing.T) {
		result, err := store.GetByPath(ctx, tests[0].path)

		if tests[0].wantError {
			assert.Error(t, err, "GetByPath() expected error but got none")
			return
		}

		require.NoError(t, err, "GetByPath() unexpected error: %v", err)
		require.NotNil(t, result, "GetByPath() returned nil document")

		assert.Equal(t, created.Path, result.Path, "Document path mismatch")
		assert.Equal(t, "Get Test Document", result.Title, "Document title mismatch")
		assert.Equal(t, testProjectAlias, result.ProjectAlias, "Document project_alias mismatch")
		assert.Equal(t, int64(1640995200000000000), result.ModificationTime, "Document mtime_ns mismatch")
		assert.Equal(t, int64(512), result.Size, "Document size_bytes mismatch")
		assert.True(t, result.HasCode, "Document has_code should be true")
		assert.False(t, result.HasImages, "Document has_images should be false")
		assert.True(t, result.HasLinks, "Document has_links should be true")
		assert.NotEmpty(t, result.CreatedAt, "CreatedAt should not be empty")
		assert.NotEmpty(t, result.UpdatedAt, "UpdatedAt should not be empty")
	})

	// Test getting non-existent document
	t.Run(tests[1].name, func(t *testing.T) {
		_, err := store.GetByPath(ctx, tests[1].path)

		if !tests[1].wantError {
			assert.NoError(t, err, "GetByPath() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByPath() expected error but got none")
	})

	// Soft delete the document and test getting it
	err = store.SoftDelete(ctx, created.Path)
	require.NoError(t, err, "Failed to soft delete document")

	t.Run(tests[2].name, func(t *testing.T) {
		_, err := store.GetByPath(ctx, tests[2].path)

		if !tests[2].wantError {
			assert.NoError(t, err, "GetByPath() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByPath() expected error but got none")
	})
}

func TestStore_Get(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test documents
	doc1 := New(docPath(testProjectAlias, "alpha/document1.json"), testProjectAlias, "Alpha Document 1",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	doc2 := New(docPath(testProjectAlias, "beta/document2.json"), testProjectAlias, "Beta Document 2",
		WithModificationTime(1641081600000000000), // 2022-01-02
		WithSize(2048),
		WithMetadata(false, true, false),
	)

	doc3 := New(docPath(testProjectAlias, "gamma/document3.json"), testProjectAlias, "Gamma Document 3",
		WithModificationTime(1641168000000000000), // 2022-01-03
		WithSize(512),
		WithMetadata(true, false, true),
	)

	_, err := store.Create(ctx, doc1)
	require.NoError(t, err, "Failed to create document 1")

	time.Sleep(10 * time.Millisecond) // Ensure different timestamps

	created2, err := store.Create(ctx, doc2)
	require.NoError(t, err, "Failed to create document 2")

	time.Sleep(10 * time.Millisecond)

	_, err = store.Create(ctx, doc3)
	require.NoError(t, err, "Failed to create document 3")

	tests := []struct {
		name        string
		filters     *GetFilters
		wantCount   int
		description string
	}{
		{
			name: "get all documents",
			filters: &GetFilters{
				IncludeDeleted: false,
			},
			wantCount:   3,
			description: "Should return all active documents",
		},
		{
			name: "get documents by project alias",
			filters: &GetFilters{
				ProjectAlias:   stringPtr(testProjectAlias),
				IncludeDeleted: false,
			},
			wantCount:   3,
			description: "Should return documents with matching project alias",
		},
		{
			name: "get documents by title like",
			filters: &GetFilters{
				TitleLike:      stringPtr("Beta"),
				IncludeDeleted: false,
			},
			wantCount:   1,
			description: "Should return documents with matching title",
		},
		{
			name: "get documents with code",
			filters: &GetFilters{
				HasCode:        boolPtr(true),
				IncludeDeleted: false,
			},
			wantCount:   2, // doc1 and doc3 have code
			description: "Should return documents with code",
		},
		{
			name: "get documents with images",
			filters: &GetFilters{
				HasImages:      boolPtr(true),
				IncludeDeleted: false,
			},
			wantCount:   2, // doc1 and doc2 have images
			description: "Should return documents with images",
		},
		{
			name: "get documents with links",
			filters: &GetFilters{
				HasLinks:       boolPtr(true),
				IncludeDeleted: false,
			},
			wantCount:   2, // doc1 and doc3 have links
			description: "Should return documents with links",
		},
		{
			name: "get documents including deleted",
			filters: &GetFilters{
				IncludeDeleted: true,
			},
			wantCount:   3,
			description: "Should return all documents including deleted",
		},
		{
			name: "get documents with no matches",
			filters: &GetFilters{
				ProjectAlias:   stringPtr("non-existent"),
				IncludeDeleted: false,
			},
			wantCount:   0,
			description: "Should return empty list for no matches",
		},
		{
			name: "get documents with multiple filters",
			filters: &GetFilters{
				ProjectAlias:   stringPtr(testProjectAlias),
				HasCode:        boolPtr(true),
				HasImages:      boolPtr(true),
				IncludeDeleted: false,
			},
			wantCount:   1, // Only doc1 matches all criteria
			description: "Should return documents matching all filters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			documents, err := store.Get(ctx, tt.filters)
			require.NoError(t, err, "Get() failed: %v", err)
			assert.Len(t, documents, tt.wantCount, "Get() returned wrong number of documents")

			// Verify documents are ordered by created_at DESC
			if len(documents) > 1 {
				for i := 1; i < len(documents); i++ {
					assert.True(t, documents[i-1].CreatedAt >= documents[i].CreatedAt,
						"Documents should be ordered by created_at DESC")
				}
			}
		})
	}

	// Test with soft deleted document
	err = store.SoftDelete(ctx, created2.Path)
	require.NoError(t, err, "Failed to soft delete document 2")

	t.Run("get documents excluding deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: false,
		}
		documents, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, documents, 2, "Should exclude soft deleted document")

		// Verify deleted document is not in results
		for _, document := range documents {
			assert.NotEqual(t, created2.Path, document.Path, "Should not include soft deleted document")
		}
	})

	t.Run("get documents including deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: true,
		}
		documents, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, documents, 3, "Should include soft deleted document")
	})
}

func TestStore_GetByPathTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	document := New(docPath(testProjectAlias, "get-tx/test/document.json"), testProjectAlias, "Get Tx Test Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, false, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create test document")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	result, err := store.GetByPathTx(ctx, tx, created.Path)
	require.NoError(t, err, "GetByPathTx() failed")
	require.NotNil(t, result, "GetByPathTx() returned nil document")

	assert.Equal(t, created.Path, result.Path, "Document path mismatch")
	assert.Equal(t, "Get Tx Test Document", result.Title, "Document title mismatch")
	assert.Equal(t, testProjectAlias, result.ProjectAlias, "Document project_alias mismatch")
	assert.True(t, result.HasCode, "Document has_code should be true")
	assert.False(t, result.HasImages, "Document has_images should be false")
	assert.True(t, result.HasLinks, "Document has_links should be true")

	_, err = store.GetByPathTx(ctx, tx, "/non/existent/path.json")
	assert.Error(t, err, "GetByPathTx() should error for non-existent document")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_GetTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	doc1 := New(docPath(testProjectAlias, "get-tx/doc1.json"), testProjectAlias, "Get Tx Doc 1",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	doc2 := New(docPath(testProjectAlias, "get-tx/doc2.json"), testProjectAlias, "Get Tx Doc 2",
		WithModificationTime(1641081600000000000),
		WithSize(2048),
		WithMetadata(false, true, false),
	)

	created1, err := store.Create(ctx, doc1)
	require.NoError(t, err, "Failed to create document 1")

	time.Sleep(10 * time.Millisecond)

	created2, err := store.Create(ctx, doc2)
	require.NoError(t, err, "Failed to create document 2")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	filters := &GetFilters{
		IncludeDeleted: false,
	}

	documents, err := store.GetTx(ctx, tx, filters)
	require.NoError(t, err, "GetTx() failed")
	require.Len(t, documents, 2, "Should return 2 documents")

	assert.Equal(t, created2.Path, documents[0].Path, "First document path mismatch (should be ordered by created_at DESC)")
	assert.Equal(t, created1.Path, documents[1].Path, "Second document path mismatch")

	projectFilters := &GetFilters{
		ProjectAlias:   &[]string{testProjectAlias}[0],
		IncludeDeleted: false,
	}

	filteredDocs, err := store.GetTx(ctx, tx, projectFilters)
	require.NoError(t, err, "GetTx() with project filter failed")
	require.Len(t, filteredDocs, 2, "Should return 2 documents for @test-project")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_Update(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "update/test/document.json"), testProjectAlias, "Original Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for update test")

	// Wait a bit to ensure updated_at changes
	time.Sleep(10 * time.Millisecond)

	tests := []struct {
		name        string
		document    *Document
		wantError   bool
		description string
	}{
		{
			name: "update all fields",
			document: &Document{
				Path:             created.Path,
				ProjectAlias:     testProjectAlias,
				Title:            "Updated Document",
				ModificationTime: 1641081600000000000, // 2022-01-02
				Size:             2048,
				HasCode:          false,
				HasImages:        false,
				HasLinks:         false,
			},
			wantError:   false,
			description: "Should update all document fields",
		},
		{
			name: "update with same project alias",
			document: &Document{
				Path:             created.Path,
				ProjectAlias:     testProjectAlias,
				Title:            "Updated Document 2",
				ModificationTime: 1641168000000000000, // 2022-01-03
				Size:             512,
				HasCode:          true,
				HasImages:        true,
				HasLinks:         true,
			},
			wantError:   false,
			description: "Should update document with same project alias",
		},
		{
			name: "update non-existent document",
			document: &Document{
				Path:             "/non/existent/path.json",
				ProjectAlias:     testProjectAlias,
				Title:            "Non-existent Document",
				ModificationTime: 1640995200000000000,
				Size:             1024,
				HasCode:          true,
				HasImages:        true,
				HasLinks:         true,
			},
			wantError:   true, // Update with no matching rows should error
			description: "Should error when updating non-existent document",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := store.Update(ctx, tt.document)

			if tt.wantError {
				assert.Error(t, err, "Update() expected error but got none")
				return
			}

			require.NoError(t, err, "Update() unexpected error: %v", err)
			require.NotNil(t, result, "Update() returned nil document")

			// Verify the update (only for existing documents)
			if tt.document.Path == created.Path {
				retrieved, err := store.GetByPath(ctx, tt.document.Path)
				require.NoError(t, err, "GetByPath() failed to retrieve updated document")

				assert.Equal(t, tt.document.ProjectAlias, retrieved.ProjectAlias, "Document project_alias mismatch")
				assert.Equal(t, tt.document.Title, retrieved.Title, "Document title mismatch")
				assert.Equal(t, tt.document.ModificationTime, retrieved.ModificationTime, "Document mtime_ns mismatch")
				assert.Equal(t, tt.document.Size, retrieved.Size, "Document size_bytes mismatch")
				assert.Equal(t, tt.document.HasCode, retrieved.HasCode, "Document has_code mismatch")
				assert.Equal(t, tt.document.HasImages, retrieved.HasImages, "Document has_images mismatch")
				assert.Equal(t, tt.document.HasLinks, retrieved.HasLinks, "Document has_links mismatch")

				// Verify updated_at changed
				assert.NotEqual(t, created.UpdatedAt, retrieved.UpdatedAt, "UpdatedAt should have changed")
			}
		})
	}
}

func TestStore_UpdateTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "update/tx/document.json"), testProjectAlias, "Original Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for update test")

	// Update within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	updatedDocument := &Document{
		Path:             created.Path,
		ProjectAlias:     testProjectAlias,
		Title:            "Transaction Updated Document",
		ModificationTime: 1641081600000000000,
		Size:             2048,
		HasCode:          false,
		HasImages:        false,
		HasLinks:         false,
	}

	result, err := store.UpdateTx(ctx, tx, updatedDocument)
	require.NoError(t, err, "UpdateTx() failed")
	require.NotNil(t, result, "UpdateTx() returned nil document")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify update persisted
	retrieved, err := store.GetByPath(ctx, created.Path)
	require.NoError(t, err, "GetByPath() failed to retrieve updated document")
	assert.Equal(t, "Transaction Updated Document", retrieved.Title)
}

func TestStore_SoftDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "delete/test/document.json"), testProjectAlias, "To Delete Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for delete test")

	tests := []struct {
		name        string
		path        string
		wantError   bool
		description string
	}{
		{
			name:        "delete existing document",
			path:        created.Path,
			wantError:   false,
			description: "Should soft delete existing document",
		},
		{
			name:        "delete non-existent document",
			path:        "/non/existent/path.json",
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting non-existent document",
		},
		{
			name:        "delete already deleted document",
			path:        created.Path,
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting already deleted document",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.SoftDelete(ctx, tt.path)

			if tt.wantError {
				assert.Error(t, err, "SoftDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "SoftDelete() unexpected error: %v", err)

			// Verify the document is soft deleted (only for existing documents)
			if tt.path == created.Path && tt.name == "delete existing document" {
				_, err := store.GetByPath(ctx, tt.path)
				assert.Error(t, err, "GetByPath() should have failed for soft deleted document")

				// Verify it doesn't appear in Get with default filters
				documents, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, document := range documents {
					assert.NotEqual(t, tt.path, document.Path, "Soft deleted document should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_SoftDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "delete/tx/document.json"), testProjectAlias, "To Delete Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for delete test")

	// Delete within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.SoftDeleteTx(ctx, tx, created.Path)
	require.NoError(t, err, "SoftDeleteTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify deletion persisted
	_, err = store.GetByPath(ctx, created.Path)
	assert.Error(t, err, "GetByPath() should have failed for soft deleted document")
}

func TestStore_Restore(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create and then soft delete a document
	document := New(docPath(testProjectAlias, "restore/test/document.json"), testProjectAlias, "To Restore Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for restore test")

	err = store.SoftDelete(ctx, created.Path)
	require.NoError(t, err, "Failed to soft delete document")

	tests := []struct {
		name        string
		path        string
		wantError   bool
		description string
	}{
		{
			name:        "restore deleted document",
			path:        created.Path,
			wantError:   false,
			description: "Should restore soft deleted document",
		},
		{
			name:        "restore non-existent document",
			path:        "/non/existent/path.json",
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring non-existent document",
		},
		{
			name:        "restore already active document",
			path:        created.Path,
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring already active document",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.Restore(ctx, tt.path)

			if tt.wantError {
				assert.Error(t, err, "Restore() expected error but got none")
				return
			}

			require.NoError(t, err, "Restore() unexpected error: %v", err)

			// Verify the document is restored (only for existing documents)
			if tt.path == created.Path && tt.name == "restore deleted document" {
				retrieved, err := store.GetByPath(ctx, tt.path)
				require.NoError(t, err, "GetByPath() failed to retrieve restored document")
				assert.Equal(t, "To Restore Document", retrieved.Title)

				// Verify it appears in Get with default filters
				documents, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				found := false
				for _, document := range documents {
					if document.Path == tt.path {
						found = true
						break
					}
				}
				assert.True(t, found, "Restored document should appear in Get results")
			}
		})
	}
}

func TestStore_RestoreTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create and then soft delete a document
	document := New(docPath(testProjectAlias, "restore/tx/document.json"), testProjectAlias, "To Restore Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for restore test")

	err = store.SoftDelete(ctx, created.Path)
	require.NoError(t, err, "Failed to soft delete document")

	// Restore within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.RestoreTx(ctx, tx, created.Path)
	require.NoError(t, err, "RestoreTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify restoration persisted
	retrieved, err := store.GetByPath(ctx, created.Path)
	require.NoError(t, err, "GetByPath() failed to retrieve restored document")
	assert.Equal(t, "To Restore Document", retrieved.Title)
}

func TestStore_HardDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "hard-delete/test/document.json"), testProjectAlias, "To Hard Delete Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for hard delete test")

	tests := []struct {
		name        string
		path        string
		wantError   bool
		description string
	}{
		{
			name:        "hard delete existing document",
			path:        created.Path,
			wantError:   false,
			description: "Should hard delete existing document",
		},
		{
			name:        "hard delete non-existent document",
			path:        "/non/existent/path.json",
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting non-existent document",
		},
		{
			name:        "hard delete already deleted document",
			path:        created.Path,
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting already deleted document",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.HardDelete(ctx, tt.path)

			if tt.wantError {
				assert.Error(t, err, "HardDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "HardDelete() unexpected error: %v", err)

			// Verify the document is hard deleted (only for existing documents)
			if tt.path == created.Path && tt.name == "hard delete existing document" {
				_, err := store.GetByPath(ctx, tt.path)
				assert.Error(t, err, "GetByPath() should have failed for hard deleted document")

				// Verify it doesn't appear in Get with any filters
				documents, err := store.Get(ctx, &GetFilters{IncludeDeleted: true})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, document := range documents {
					assert.NotEqual(t, tt.path, document.Path, "Hard deleted document should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_HardDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document first
	document := New(docPath(testProjectAlias, "hard-delete/tx/document.json"), testProjectAlias, "To Hard Delete Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for hard delete test")

	// Hard delete within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.HardDeleteTx(ctx, tx, created.Path)
	require.NoError(t, err, "HardDeleteTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify deletion persisted
	_, err = store.GetByPath(ctx, created.Path)
	assert.Error(t, err, "GetByPath() should have failed for hard deleted document")
}

func TestStore_EdgeCases(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create document with very long path", func(t *testing.T) {
		longSuffix := strings.Repeat("a", 1000) + ".json"
		longPath := docPath(testProjectAlias, longSuffix)

		document := New(longPath, testProjectAlias, "Long Path Document")

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with long path failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for long path document: %v", err)
		assert.Len(t, retrieved.Path, len(longPath), "Document path length mismatch")
	})

	t.Run("create document with special characters in path", func(t *testing.T) {
		specialSuffix := "path/with Special Chars: !@#$%^&*()_+-=[]{}|;':\",./<>?.json"
		specialPath := docPath(testProjectAlias, specialSuffix)
		document := New(specialPath, testProjectAlias, "Special Path Document")

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with special characters failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for special characters document: %v", err)
		assert.Equal(t, specialPath, retrieved.Path, "Document path mismatch")
	})

	t.Run("create document with unicode characters", func(t *testing.T) {
		unicodeSuffix := "文档路径/with émojis 🚀 and ñ characters.json"
		unicodePath := docPath(testProjectAlias, unicodeSuffix)
		unicodeTitle := "文档标题 with émojis 🚀 and ñ characters"
		document := New(unicodePath, testProjectAlias, unicodeTitle)

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with unicode characters failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for unicode document: %v", err)
		assert.Equal(t, unicodePath, retrieved.Path, "Document path mismatch")
		assert.Equal(t, unicodeTitle, retrieved.Title, "Document title mismatch")
	})

	t.Run("create document with very large modification time", func(t *testing.T) {
		largeMtime := int64(9223372036854775807) // Max int64
		document := New(docPath(testProjectAlias, "large/mtime/document.json"), testProjectAlias, "Large Mtime Document",
			WithModificationTime(largeMtime),
		)

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with large mtime failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for large mtime document: %v", err)
		assert.Equal(t, largeMtime, retrieved.ModificationTime, "Document mtime_ns mismatch")
	})

	t.Run("create document with very large size", func(t *testing.T) {
		largeSize := int64(9223372036854775807) // Max int64
		document := New(docPath(testProjectAlias, "large/size/document.json"), testProjectAlias, "Large Size Document",
			WithSize(largeSize),
		)

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with large size failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for large size document: %v", err)
		assert.Equal(t, largeSize, retrieved.Size, "Document size_bytes mismatch")
	})

	t.Run("create document with zero values", func(t *testing.T) {
		document := New(docPath(testProjectAlias, "zero/values/document.json"), testProjectAlias, "Zero Values Document",
			WithModificationTime(0),
			WithSize(0),
			WithMetadata(false, false, false),
		)

		created, err := store.Create(ctx, document)
		require.NoError(t, err, "Create() with zero values failed: %v", err)

		retrieved, err := store.GetByPath(ctx, created.Path)
		require.NoError(t, err, "GetByPath() failed for zero values document: %v", err)
		assert.Equal(t, testProjectAlias, retrieved.ProjectAlias, "Document project_alias should be @test-project")
		assert.Equal(t, int64(0), retrieved.ModificationTime, "Document mtime_ns should be 0")
		assert.Equal(t, int64(0), retrieved.Size, "Document size_bytes should be 0")
		assert.False(t, retrieved.HasCode, "Document has_code should be false")
		assert.False(t, retrieved.HasImages, "Document has_images should be false")
		assert.False(t, retrieved.HasLinks, "Document has_links should be false")
	})
}

func TestStore_ConcurrentAccess(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Test concurrent creation with proper transaction handling
	const numGoroutines = 10
	results := make(chan string, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			// Retry logic for SQLite BUSY errors
			maxRetries := 10
			for attempt := 0; attempt < maxRetries; attempt++ {
				alias := testProjectAlias
				suffix := fmt.Sprintf("concurrent/document%[1]c.json", 'A'+i)
				path := docPath(alias, suffix)
				document := New(path, alias, fmt.Sprintf("Concurrent Document %c", 'A'+i))

				created, err := store.Create(ctx, document)
				if err != nil {
					if attempt < maxRetries-1 {
						time.Sleep(time.Millisecond * 10)
						continue
					}
					errors <- err
					return
				}

				// Success!
				results <- created.Path
				return
			}
		}(i)
	}

	// Collect results
	var paths []string
	for i := 0; i < numGoroutines; i++ {
		select {
		case path := <-results:
			paths = append(paths, path)
		case err := <-errors:
			t.Errorf("Concurrent create failed: %v", err)
		}
	}

	assert.Len(t, paths, numGoroutines, "Expected %d concurrent creates, got %d", numGoroutines, len(paths))

	// Verify all documents were created
	documents, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
	require.NoError(t, err, "Get() failed: %v", err)
	assert.GreaterOrEqual(t, len(documents), numGoroutines, "Expected at least %d documents in Get results", numGoroutines)
}

func TestStore_ContextCancellation(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	// Test with cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	cancelledAlias := "@cancelled"
	document := New(docPath(cancelledAlias, "cancelled/document.json"), cancelledAlias, "Cancelled Document")

	_, err := store.Create(ctx, document)
	assert.Error(t, err, "Create() with cancelled context should have failed")

	// Test with timeout context
	ctx, cancel = context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()
	time.Sleep(1 * time.Millisecond) // Ensure timeout

	_, err = store.Create(ctx, document)
	assert.Error(t, err, "Create() with timeout context should have failed")
}

func TestStore_TransactionIsolation(t *testing.T) {
	t.Skip("Skipping due to SQLite WAL transaction goroutine leak - test causes hang")

	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a document
	document := New(docPath(testProjectAlias, "isolation/test/document.json"), testProjectAlias, "Isolation Test Document",
		WithModificationTime(1640995200000000000),
		WithSize(1024),
		WithMetadata(true, true, true),
	)

	created, err := store.Create(ctx, document)
	require.NoError(t, err, "Failed to create document for isolation test")

	// Start a transaction and update the document
	db := store.db
	tx1, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 1")

	updatedDocument := &Document{
		Path:             created.Path,
		ProjectAlias:     testProjectAlias,
		Title:            "Updated in Transaction",
		ModificationTime: 1641081600000000000,
		Size:             2048,
		HasCode:          false,
		HasImages:        false,
		HasLinks:         false,
	}

	_, err = store.UpdateTx(ctx, tx1, updatedDocument)
	require.NoError(t, err, "UpdateTx() failed")

	// In another transaction, try to read the document (should see old data)
	tx2, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 2")

	// Create a temporary store with tx2 for reading
	tempStore := &Store{db: db}

	// This should still see the old data because tx1 hasn't committed
	retrieved, err := tempStore.GetByPath(ctx, created.Path)
	require.NoError(t, err, "GetByPath() failed")
	assert.Equal(t, "Isolation Test Document", retrieved.Title, "Should see old data before commit")

	// Commit tx1 BEFORE checking tx2 again
	err = tx1.Commit()
	require.NoError(t, err, "Failed to commit transaction 1")

	// Now tx2 should still see old data (read committed isolation)
	retrieved, err = tempStore.GetByPath(ctx, created.Path)
	require.NoError(t, err, "GetByPath() failed")
	assert.Equal(t, "Updated in Transaction", retrieved.Title, "Should see updated data after commit")

	// Commit tx2 - critical to prevent goroutine leak
	err = tx2.Commit()
	require.NoError(t, err, "Failed to commit transaction 2")
}

func TestStore_PathUniqueness(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create first document
	doc1 := New(docPath(testProjectAlias, "unique/path/document.json"), testProjectAlias, "First Document")
	_, err := store.Create(ctx, doc1)
	require.NoError(t, err, "Failed to create first document")

	// Try to create second document with same path
	doc2 := New(docPath(testProjectAlias, "unique/path/document.json"), testProjectAlias, "Second Document")
	_, err = store.Create(ctx, doc2)
	assert.Error(t, err, "Should error when creating document with duplicate path")

	// Verify first document still exists
	retrieved, err := store.GetByPath(ctx, doc1.Path)
	require.NoError(t, err, "Failed to retrieve first document")
	assert.Equal(t, "First Document", retrieved.Title)
}

func TestStore_NewStore(t *testing.T) {
	database := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, database)

	store := NewStore(database)

	assert.NotNil(t, store, "Store should not be nil")
	assert.Equal(t, database, store.db, "Database should be set correctly")
}

// Helper functions for test data
func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
