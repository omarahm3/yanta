package journal

import (
	"context"
	"os"
	"strings"
	"testing"

	"yanta/internal/vault"
)

func setupTestService(t *testing.T) (*Service, string) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "journal-service-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	v, err := vault.New(vault.Config{RootPath: tmpDir})
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to create vault: %v", err)
	}

	svc := NewService(v, nil, nil) // eventBus and ftsStore nil for tests

	return svc, tmpDir
}

func cleanupTestService(tmpDir string) {
	os.RemoveAll(tmpDir)
}

func TestService_AppendEntry_NewDay(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Fix the auth bug",
		Tags:         []string{"urgent", "backend"},
	}

	entry, err := svc.AppendEntry(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry: %v", err)
	}

	if entry == nil {
		t.Fatal("expected non-nil entry")
	}
	if entry.ID == "" {
		t.Error("expected non-empty ID")
	}
	if entry.Content != "Fix the auth bug" {
		t.Errorf("expected content %q, got %q", "Fix the auth bug", entry.Content)
	}
	if len(entry.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(entry.Tags))
	}
}

func TestService_AppendEntry_ExistingDay(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Append first entry
	req1 := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "First entry",
		Tags:         nil,
	}
	_, err := svc.AppendEntry(ctx, req1)
	if err != nil {
		t.Fatalf("failed to append first entry: %v", err)
	}

	// Append second entry
	req2 := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Second entry",
		Tags:         []string{"tag1"},
	}
	_, err = svc.AppendEntry(ctx, req2)
	if err != nil {
		t.Fatalf("failed to append second entry: %v", err)
	}

	// Get today's journal and verify both entries exist
	journal, err := svc.GetToday(ctx, "@personal")
	if err != nil {
		t.Fatalf("failed to get today: %v", err)
	}

	if len(journal.Entries) != 2 {
		t.Errorf("expected 2 entries, got %d", len(journal.Entries))
	}
}

func TestService_AppendEntry_EmptyContent(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "",
		Tags:         nil,
	}

	_, err := svc.AppendEntry(ctx, req)
	if err == nil {
		t.Error("expected error for empty content")
	}
	if !strings.Contains(err.Error(), "content") {
		t.Errorf("expected error about content, got: %v", err)
	}
}

func TestService_AppendEntry_WhitespaceContent(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "   \n\t  ",
		Tags:         nil,
	}

	_, err := svc.AppendEntry(ctx, req)
	if err == nil {
		t.Error("expected error for whitespace-only content")
	}
}

func TestService_GetToday(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Get today when empty
	journal, err := svc.GetToday(ctx, "@personal")
	if err != nil {
		t.Fatalf("failed to get today: %v", err)
	}
	if len(journal.Entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(journal.Entries))
	}

	// Add entry and get again
	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Test entry",
		Tags:         nil,
	}
	_, err = svc.AppendEntry(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry: %v", err)
	}

	journal, err = svc.GetToday(ctx, "@personal")
	if err != nil {
		t.Fatalf("failed to get today after append: %v", err)
	}
	if len(journal.Entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(journal.Entries))
	}
}

func TestService_GetByDate(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Get non-existent date
	journal, err := svc.GetByDate(ctx, "@personal", "2026-01-15")
	if err != nil {
		t.Fatalf("failed to get by date: %v", err)
	}
	if len(journal.Entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(journal.Entries))
	}
}

func TestService_GetByDate_InvalidDateFormat(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	_, err := svc.GetByDate(ctx, "@personal", "invalid-date")
	if err == nil {
		t.Error("expected error for invalid date format")
	}
	if !strings.Contains(err.Error(), "invalid date") {
		t.Errorf("expected invalid date error, got: %v", err)
	}
}

func TestService_DeleteEntry(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create entry
	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "To be deleted",
		Tags:         nil,
	}
	entry, err := svc.AppendEntry(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry: %v", err)
	}

	// Delete the entry
	err = svc.DeleteEntry(ctx, "@personal", TodayDate(), entry.ID)
	if err != nil {
		t.Fatalf("failed to delete entry: %v", err)
	}

	// Verify entry is soft deleted
	journal, err := svc.GetToday(ctx, "@personal")
	if err != nil {
		t.Fatalf("failed to get today: %v", err)
	}

	// Should still have the entry but marked as deleted
	found := false
	for _, e := range journal.Entries {
		if e.ID == entry.ID {
			found = true
			if !e.Deleted {
				t.Error("expected entry to be marked as deleted")
			}
		}
	}
	if !found {
		t.Error("deleted entry should still exist in file")
	}
}

func TestService_DeleteEntry_NonExistent(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	err := svc.DeleteEntry(ctx, "@personal", TodayDate(), "nonexistent-id")
	if err == nil {
		t.Error("expected error for non-existent entry")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected not found error, got: %v", err)
	}
}

func TestService_UpdateEntry(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create entry
	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Original content",
		Tags:         []string{"old-tag"},
	}
	entry, err := svc.AppendEntry(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry: %v", err)
	}

	// Update the entry
	updateReq := UpdateEntryRequest{
		ProjectAlias: "@personal",
		Date:         TodayDate(),
		EntryID:      entry.ID,
		Content:      "Updated content",
		Tags:         []string{"new-tag1", "new-tag2"},
	}
	updatedEntry, err := svc.UpdateEntry(ctx, updateReq)
	if err != nil {
		t.Fatalf("failed to update entry: %v", err)
	}

	if updatedEntry.Content != "Updated content" {
		t.Errorf("expected content %q, got %q", "Updated content", updatedEntry.Content)
	}
	if len(updatedEntry.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(updatedEntry.Tags))
	}
}

func TestService_UpdateEntry_ContentOnly(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create entry with tags
	req := AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Original",
		Tags:         []string{"keep-this"},
	}
	entry, err := svc.AppendEntry(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry: %v", err)
	}

	// Update content only (nil tags means keep existing)
	updateReq := UpdateEntryRequest{
		ProjectAlias: "@personal",
		Date:         TodayDate(),
		EntryID:      entry.ID,
		Content:      "New content",
		Tags:         nil, // nil means keep existing
	}
	updated, err := svc.UpdateEntry(ctx, updateReq)
	if err != nil {
		t.Fatalf("failed to update entry: %v", err)
	}

	if updated.Content != "New content" {
		t.Errorf("expected %q, got %q", "New content", updated.Content)
	}
	if len(updated.Tags) != 1 || updated.Tags[0] != "keep-this" {
		t.Errorf("tags should be preserved, got %v", updated.Tags)
	}
}

func TestService_ListDates(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create some entries on different dates (using the store directly for specific dates)
	store := NewStore(svc.vault)

	dates := []string{"2026-01-28", "2026-01-29", "2026-01-30"}
	for _, date := range dates {
		file := NewJournalFile("@personal", date)
		entry := NewJournalEntry("Entry for "+date, nil)
		file.AppendEntry(entry)
		if err := store.WriteFile("@personal", date, file); err != nil {
			t.Fatalf("failed to create journal for %s: %v", date, err)
		}
	}

	// List all dates
	listedDates, err := svc.ListDates(ctx, "@personal", 0, 0)
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}

	if len(listedDates) != 3 {
		t.Errorf("expected 3 dates, got %d", len(listedDates))
	}
}

func TestService_ListDates_YearMonth(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	store := NewStore(svc.vault)

	// Create journals in different months
	dates := []string{"2026-01-15", "2026-01-30", "2026-02-01", "2025-12-31"}
	for _, date := range dates {
		file := NewJournalFile("@personal", date)
		if err := store.WriteFile("@personal", date, file); err != nil {
			t.Fatalf("failed to create journal for %s: %v", date, err)
		}
	}

	// List only January 2026
	janDates, err := svc.ListDates(ctx, "@personal", 2026, 1)
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}

	if len(janDates) != 2 {
		t.Errorf("expected 2 dates for Jan 2026, got %d: %v", len(janDates), janDates)
	}
}

func TestService_GetActiveEntries(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create multiple entries
	for i := 0; i < 3; i++ {
		req := AppendEntryRequest{
			ProjectAlias: "@personal",
			Content:      "Entry " + string(rune('A'+i)),
			Tags:         nil,
		}
		_, err := svc.AppendEntry(ctx, req)
		if err != nil {
			t.Fatalf("failed to append entry %d: %v", i, err)
		}
	}

	// Delete the second one
	journal, _ := svc.GetToday(ctx, "@personal")
	if len(journal.Entries) < 2 {
		t.Fatal("expected at least 2 entries")
	}
	entryToDelete := journal.Entries[1].ID
	if err := svc.DeleteEntry(ctx, "@personal", TodayDate(), entryToDelete); err != nil {
		t.Fatalf("failed to delete entry: %v", err)
	}

	// Get active entries only
	activeEntries, err := svc.GetActiveEntries(ctx, "@personal", TodayDate())
	if err != nil {
		t.Fatalf("failed to get active entries: %v", err)
	}

	if len(activeEntries) != 2 {
		t.Errorf("expected 2 active entries, got %d", len(activeEntries))
	}
}

func TestService_PromoteToDocument(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create entries
	entry1, _ := svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "First note to promote",
		Tags:         []string{"tag1"},
	})
	entry2, _ := svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Second note to promote",
		Tags:         []string{"tag2"},
	})

	req := PromoteRequest{
		SourceProject: "@personal",
		Date:          TodayDate(),
		EntryIDs:      []string{entry1.ID, entry2.ID},
		TargetProject: "@personal",
		Title:         "Promoted Notes",
		KeepOriginal:  false, // move
	}

	docPath, err := svc.PromoteToDocument(ctx, req)
	if err != nil {
		t.Fatalf("failed to promote: %v", err)
	}

	if docPath == "" {
		t.Error("expected non-empty document path")
	}

	// Verify entries are marked deleted (since KeepOriginal = false)
	journal, _ := svc.GetToday(ctx, "@personal")
	for _, e := range journal.Entries {
		if e.ID == entry1.ID || e.ID == entry2.ID {
			if !e.Deleted {
				t.Errorf("entry %s should be deleted after promote with KeepOriginal=false", e.ID)
			}
		}
	}
}

func TestService_PromoteToDocument_Copy(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	entry1, _ := svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Note to copy",
		Tags:         nil,
	})

	req := PromoteRequest{
		SourceProject: "@personal",
		Date:          TodayDate(),
		EntryIDs:      []string{entry1.ID},
		TargetProject: "@work",
		Title:         "Copied Note",
		KeepOriginal:  true, // copy
	}

	_, err := svc.PromoteToDocument(ctx, req)
	if err != nil {
		t.Fatalf("failed to promote: %v", err)
	}

	// Verify original is NOT deleted
	journal, _ := svc.GetToday(ctx, "@personal")
	for _, e := range journal.Entries {
		if e.ID == entry1.ID {
			if e.Deleted {
				t.Error("entry should NOT be deleted with KeepOriginal=true")
			}
		}
	}
}

func TestService_PromoteToDocument_WholeDay(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create multiple entries
	for i := 0; i < 3; i++ {
		_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
			ProjectAlias: "@personal",
			Content:      "Entry " + string(rune('A'+i)),
			Tags:         nil,
		})
	}

	// Promote whole day (empty EntryIDs)
	req := PromoteRequest{
		SourceProject: "@personal",
		Date:          TodayDate(),
		EntryIDs:      []string{}, // empty means whole day
		TargetProject: "@personal",
		Title:         "Whole Day Notes",
		KeepOriginal:  false,
	}

	_, err := svc.PromoteToDocument(ctx, req)
	if err != nil {
		t.Fatalf("failed to promote whole day: %v", err)
	}

	// All entries should be deleted
	journal, _ := svc.GetToday(ctx, "@personal")
	for _, e := range journal.Entries {
		if !e.Deleted {
			t.Errorf("entry %s should be deleted", e.ID)
		}
	}
}

func TestService_AppendEntry_DifferentProjects(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Add entries to different projects
	_, err := svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Personal note",
		Tags:         nil,
	})
	if err != nil {
		t.Fatalf("failed to append to @personal: %v", err)
	}

	_, err = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@work",
		Content:      "Work note",
		Tags:         nil,
	})
	if err != nil {
		t.Fatalf("failed to append to @work: %v", err)
	}

	// Verify they're in separate journals
	personal, _ := svc.GetToday(ctx, "@personal")
	work, _ := svc.GetToday(ctx, "@work")

	if len(personal.Entries) != 1 {
		t.Errorf("expected 1 personal entry, got %d", len(personal.Entries))
	}
	if len(work.Entries) != 1 {
		t.Errorf("expected 1 work entry, got %d", len(work.Entries))
	}

	if personal.Entries[0].Content != "Personal note" {
		t.Error("personal entry has wrong content")
	}
	if work.Entries[0].Content != "Work note" {
		t.Error("work entry has wrong content")
	}
}

func TestService_AppendEntry_WithSpecificDate(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	req := AppendEntryRequestWithDate{
		ProjectAlias: "@personal",
		Content:      "Backdated entry",
		Tags:         nil,
		Date:         "2026-01-15", // specific date
	}

	entry, err := svc.AppendEntryToDate(ctx, req)
	if err != nil {
		t.Fatalf("failed to append entry to date: %v", err)
	}

	if entry == nil {
		t.Fatal("expected non-nil entry")
	}

	// Verify it's on the correct date
	journal, err := svc.GetByDate(ctx, "@personal", "2026-01-15")
	if err != nil {
		t.Fatalf("failed to get by date: %v", err)
	}

	if len(journal.Entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(journal.Entries))
	}
}

func TestService_SearchEntries(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	// Create entries with searchable content
	_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Fix the authentication bug in the login module",
		Tags:         []string{"bug"},
	})
	_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Meeting notes from standup",
		Tags:         nil,
	})
	_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Research authentication providers",
		Tags:         []string{"research"},
	})

	// Search for "authentication"
	results, err := svc.SearchEntries(ctx, "@personal", "authentication", 10)
	if err != nil {
		t.Fatalf("failed to search: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}

	// Verify results contain "authentication"
	for _, r := range results {
		if !strings.Contains(strings.ToLower(r.Entry.Content), "authentication") {
			t.Errorf("result should contain 'authentication': %s", r.Entry.Content)
		}
	}
}

func TestService_SearchEntries_CaseInsensitive(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "BUG: Authentication Failed",
		Tags:         nil,
	})

	// Search with lowercase
	results, err := svc.SearchEntries(ctx, "@personal", "bug", 10)
	if err != nil {
		t.Fatalf("failed to search: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("expected 1 result, got %d", len(results))
	}
}

func TestService_SearchEntries_EmptyQuery(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	results, err := svc.SearchEntries(ctx, "@personal", "", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 results for empty query, got %d", len(results))
	}
}

func TestService_SearchEntries_NoResults(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	_, _ = svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Some random note",
		Tags:         nil,
	})

	results, err := svc.SearchEntries(ctx, "@personal", "xyznonexistent", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestService_SearchEntries_ExcludesDeleted(t *testing.T) {
	svc, tmpDir := setupTestService(t)
	defer cleanupTestService(tmpDir)

	ctx := context.Background()

	entry, _ := svc.AppendEntry(ctx, AppendEntryRequest{
		ProjectAlias: "@personal",
		Content:      "Searchable content here",
		Tags:         nil,
	})

	// Delete the entry
	_ = svc.DeleteEntry(ctx, "@personal", TodayDate(), entry.ID)

	// Search should not find deleted entry
	results, err := svc.SearchEntries(ctx, "@personal", "searchable", 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 0 {
		t.Errorf("expected 0 results (deleted should be excluded), got %d", len(results))
	}
}
