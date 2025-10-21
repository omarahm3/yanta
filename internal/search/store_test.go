package search

import (
	"context"
	"fmt"
	"testing"
	"yanta/internal/testutil"
)

func TestStore_InsertDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	err := store.InsertDocument(ctx, "projects/@test/doc-1.json", "Test Title", "Heading 1", "Body text", "code block")
	if err != nil {
		t.Fatalf("InsertDocument() failed: %v", err)
	}

	// Verify inserted
	paths, err := store.Search(ctx, "Test")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(paths))
	}

	if paths[0] != "projects/@test/doc-1.json" {
		t.Errorf("Path mismatch: got %s, want projects/@test/doc-1.json", paths[0])
	}
}

func TestStore_DeleteDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert
	err := store.InsertDocument(ctx, "projects/@test/doc-1.json", "Test", "", "", "")
	if err != nil {
		t.Fatalf("InsertDocument() failed: %v", err)
	}

	// Delete
	err = store.DeleteDocument(ctx, "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("DeleteDocument() failed: %v", err)
	}

	// Verify deleted
	paths, err := store.Search(ctx, "Test")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results after delete, got %d", len(paths))
	}
}

func TestStore_UpdateDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert original
	err := store.InsertDocument(ctx, "projects/@test/doc-1.json", "Original Title", "", "", "")
	if err != nil {
		t.Fatalf("InsertDocument() failed: %v", err)
	}

	// Update
	err = store.UpdateDocument(ctx, "projects/@test/doc-1.json", "Updated Title", "", "", "")
	if err != nil {
		t.Fatalf("UpdateDocument() failed: %v", err)
	}

	// Verify updated (search for new title)
	paths, err := store.Search(ctx, "Updated")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(paths))
	}

	// Verify old title not found
	paths, err = store.Search(ctx, "Original")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results for old title, got %d", len(paths))
	}
}

func TestStore_Search(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert test documents
	docs := []struct {
		path  string
		title string
	}{
		{"projects/@test/doc-1.json", "Go Programming"},
		{"projects/@test/doc-2.json", "JavaScript Basics"},
		{"projects/@test/doc-3.json", "Go Advanced Topics"},
	}

	for _, doc := range docs {
		err := store.InsertDocument(ctx, doc.path, doc.title, "", "", "")
		if err != nil {
			t.Fatalf("InsertDocument() failed: %v", err)
		}
	}

	// Search for "Go"
	paths, err := store.Search(ctx, "Go")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 2 {
		t.Errorf("Expected 2 results for 'Go', got %d", len(paths))
	}

	// Search for "JavaScript"
	paths, err = store.Search(ctx, "JavaScript")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Errorf("Expected 1 result for 'JavaScript', got %d", len(paths))
	}

	if paths[0] != "projects/@test/doc-2.json" {
		t.Errorf("Path mismatch: got %s", paths[0])
	}
}

func TestStore_DeleteAll(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert multiple documents
	for i := 1; i <= 5; i++ {
		path := fmt.Sprintf("projects/@test/doc-%d.json", i)
		err := store.InsertDocument(ctx, path, "Test", "", "", "")
		if err != nil {
			t.Fatalf("InsertDocument() failed: %v", err)
		}
	}

	// Delete all
	err := store.DeleteAll(ctx)
	if err != nil {
		t.Fatalf("DeleteAll() failed: %v", err)
	}

	// Verify all deleted
	paths, err := store.Search(ctx, "Test")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results after DeleteAll, got %d", len(paths))
	}
}

func TestStore_InsertDocument_EmptyPath(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	err := store.InsertDocument(ctx, "", "Title", "", "", "")
	if err == nil {
		t.Error("Expected error for empty path, got nil")
	}
}

func TestStore_Search_EmptyQuery(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := store.Search(ctx, "")
	if err == nil {
		t.Error("Expected error for empty query, got nil")
	}
}

func TestStore_Transaction(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Begin transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx() failed: %v", err)
	}
	defer tx.Rollback()

	// Insert using Tx
	err = store.InsertDocumentTx(ctx, tx, "projects/@test/doc-1.json", "Title", "", "", "")
	if err != nil {
		t.Fatalf("InsertDocumentTx() failed: %v", err)
	}

	// Commit
	if err = tx.Commit(); err != nil {
		t.Fatalf("Commit() failed: %v", err)
	}

	// Verify committed
	paths, err := store.Search(ctx, "Title")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Errorf("Expected 1 result, got %d", len(paths))
	}
}

func TestStore_DeleteDocument_NotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Try to delete non-existent document
	err := store.DeleteDocument(ctx, "projects/@test/nonexistent.json")
	if err == nil {
		t.Error("Expected error for non-existent document, got nil")
	}

	if err != nil && err.Error() != "document not found in fts_doc: projects/@test/nonexistent.json" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

func TestStore_UpdateDocument_NonExistent(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Update non-existent document (should insert)
	err := store.UpdateDocument(ctx, "projects/@test/new-doc.json", "New Title", "", "", "")
	if err != nil {
		t.Fatalf("UpdateDocument() on non-existent doc failed: %v", err)
	}

	// Verify inserted
	paths, err := store.Search(ctx, "New")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 1 {
		t.Errorf("Expected 1 result, got %d", len(paths))
	}
}

func TestStore_Search_NoResults(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Search empty database
	paths, err := store.Search(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results, got %d", len(paths))
	}
}

func TestStore_TransactionRollback(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Begin transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx() failed: %v", err)
	}

	// Insert using Tx
	err = store.InsertDocumentTx(ctx, tx, "projects/@test/doc-1.json", "Rollback Test", "", "", "")
	if err != nil {
		t.Fatalf("InsertDocumentTx() failed: %v", err)
	}

	// Rollback instead of commit
	tx.Rollback()

	// Verify not inserted
	paths, err := store.Search(ctx, "Rollback")
	if err != nil {
		t.Fatalf("Search() failed: %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("Expected 0 results after rollback, got %d", len(paths))
	}
}
