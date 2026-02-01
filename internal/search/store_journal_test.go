package search

import (
	"context"
	"testing"
	"yanta/internal/testutil"
)

func TestStore_InsertJournalEntry(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", "abc123", "Fix the auth bug", []string{"urgent", "backend"})
	if err != nil {
		t.Fatalf("InsertJournalEntry() failed: %v", err)
	}

	// Verify by searching
	results, err := store.SearchJournalEntries(ctx, "auth")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}

	if results[0].EntryID != "abc123" {
		t.Errorf("EntryID mismatch: got %s, want abc123", results[0].EntryID)
	}
	if results[0].ProjectAlias != "@personal" {
		t.Errorf("ProjectAlias mismatch: got %s, want @personal", results[0].ProjectAlias)
	}
	if results[0].Date != "2026-01-30" {
		t.Errorf("Date mismatch: got %s, want 2026-01-30", results[0].Date)
	}
}

func TestStore_InsertJournalEntry_EmptyEntryID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", "", "content", nil)
	if err == nil {
		t.Error("Expected error for empty entryID, got nil")
	}
}

func TestStore_DeleteJournalEntry(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert
	err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", "abc123", "Test content", nil)
	if err != nil {
		t.Fatalf("InsertJournalEntry() failed: %v", err)
	}

	// Delete
	err = store.DeleteJournalEntry(ctx, "@personal", "2026-01-30", "abc123")
	if err != nil {
		t.Fatalf("DeleteJournalEntry() failed: %v", err)
	}

	// Verify deleted
	results, err := store.SearchJournalEntries(ctx, "Test")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 results after delete, got %d", len(results))
	}
}

func TestStore_DeleteJournalEntry_NotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	err := store.DeleteJournalEntry(ctx, "@personal", "2026-01-30", "nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent entry, got nil")
	}
}

func TestStore_UpdateJournalEntry(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert original
	err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", "abc123", "Original content", []string{"old"})
	if err != nil {
		t.Fatalf("InsertJournalEntry() failed: %v", err)
	}

	// Update
	err = store.UpdateJournalEntry(ctx, "@personal", "2026-01-30", "abc123", "Updated content", []string{"new"})
	if err != nil {
		t.Fatalf("UpdateJournalEntry() failed: %v", err)
	}

	// Verify updated (search for new content)
	results, err := store.SearchJournalEntries(ctx, "Updated")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}

	// Verify old content not found
	results, err = store.SearchJournalEntries(ctx, "Original")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 results for old content, got %d", len(results))
	}
}

func TestStore_SearchJournalEntries(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert test entries
	entries := []struct {
		project string
		date    string
		entryID string
		content string
		tags    []string
	}{
		{"@personal", "2026-01-30", "e1", "Go programming tips", []string{"go", "tips"}},
		{"@work", "2026-01-30", "e2", "JavaScript basics", []string{"js"}},
		{"@personal", "2026-01-29", "e3", "Advanced Go topics", []string{"go", "advanced"}},
	}

	for _, e := range entries {
		err := store.InsertJournalEntry(ctx, e.project, e.date, e.entryID, e.content, e.tags)
		if err != nil {
			t.Fatalf("InsertJournalEntry() failed: %v", err)
		}
	}

	// Search for "Go"
	results, err := store.SearchJournalEntries(ctx, "Go")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 results for 'Go', got %d", len(results))
	}

	// Search for "JavaScript"
	results, err = store.SearchJournalEntries(ctx, "JavaScript")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 result for 'JavaScript', got %d", len(results))
	}
}

func TestStore_SearchJournalEntries_EmptyQuery(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := store.SearchJournalEntries(ctx, "")
	if err == nil {
		t.Error("Expected error for empty query, got nil")
	}
}

func TestStore_DeleteAllJournalEntries(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert multiple entries
	for i := 1; i <= 3; i++ {
		err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", string(rune('a'+i)), "Test content", nil)
		if err != nil {
			t.Fatalf("InsertJournalEntry() failed: %v", err)
		}
	}

	// Delete all
	err := store.DeleteAllJournalEntries(ctx)
	if err != nil {
		t.Fatalf("DeleteAllJournalEntries() failed: %v", err)
	}

	// Verify all deleted
	results, err := store.SearchJournalEntries(ctx, "Test")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 results after DeleteAll, got %d", len(results))
	}
}

func TestStore_SearchJournalEntries_WithTags(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Insert entry with tags
	err := store.InsertJournalEntry(ctx, "@personal", "2026-01-30", "e1", "Note content", []string{"urgent", "bug"})
	if err != nil {
		t.Fatalf("InsertJournalEntry() failed: %v", err)
	}

	// Search for tag content
	results, err := store.SearchJournalEntries(ctx, "urgent")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 result for tag search, got %d", len(results))
	}
}

func TestStore_JournalEntry_Transaction(t *testing.T) {
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
	err = store.InsertJournalEntryTx(ctx, tx, "@personal", "2026-01-30", "tx-entry", "Transaction content", nil)
	if err != nil {
		t.Fatalf("InsertJournalEntryTx() failed: %v", err)
	}

	// Commit
	if err = tx.Commit(); err != nil {
		t.Fatalf("Commit() failed: %v", err)
	}

	// Verify committed
	results, err := store.SearchJournalEntries(ctx, "Transaction")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(results))
	}
}

func TestStore_JournalEntry_TransactionRollback(t *testing.T) {
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
	err = store.InsertJournalEntryTx(ctx, tx, "@personal", "2026-01-30", "rollback-entry", "Rollback Test", nil)
	if err != nil {
		t.Fatalf("InsertJournalEntryTx() failed: %v", err)
	}

	// Rollback instead of commit
	tx.Rollback()

	// Verify not inserted
	results, err := store.SearchJournalEntries(ctx, "Rollback")
	if err != nil {
		t.Fatalf("SearchJournalEntries() failed: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 results after rollback, got %d", len(results))
	}
}
