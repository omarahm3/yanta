package journal

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yanta/internal/vault"
)

func setupTestVault(t *testing.T) (*vault.Vault, string) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "journal-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	v, err := vault.New(vault.Config{RootPath: tmpDir})
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to create vault: %v", err)
	}

	return v, tmpDir
}

func cleanupTestVault(tmpDir string) {
	os.RemoveAll(tmpDir)
}

func TestStore_GetJournalPath(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	tests := []struct {
		name         string
		projectAlias string
		date         string
		wantPath     string
	}{
		{
			name:         "personal project",
			projectAlias: "@personal",
			date:         "2026-01-30",
			wantPath:     "projects/@personal/journal/2026-01-30.json",
		},
		{
			name:         "work project",
			projectAlias: "@work",
			date:         "2024-12-31",
			wantPath:     "projects/@work/journal/2024-12-31.json",
		},
		{
			name:         "project without @ prefix",
			projectAlias: "ideas",
			date:         "2026-01-01",
			wantPath:     "projects/ideas/journal/2026-01-01.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := store.GetJournalPath(tt.projectAlias, tt.date)
			if got != tt.wantPath {
				t.Errorf("GetJournalPath() = %q, want %q", got, tt.wantPath)
			}
		})
	}
}

func TestStore_ReadFile_NonExistent(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Reading non-existent file should create empty journal
	file, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if file == nil {
		t.Fatal("expected non-nil file")
	}
	if file.Meta.Project != "@personal" {
		t.Errorf("expected project @personal, got %q", file.Meta.Project)
	}
	if file.Meta.Date != "2026-01-30" {
		t.Errorf("expected date 2026-01-30, got %q", file.Meta.Date)
	}
	if len(file.Entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(file.Entries))
	}
}

func TestStore_WriteAndReadFile(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create a journal file with entries
	file := NewJournalFile("@personal", "2026-01-30")
	entry := NewJournalEntry("Fix the auth bug", []string{"urgent", "backend"})
	file.AppendEntry(entry)

	// Write the file
	err := store.WriteFile("@personal", "2026-01-30", file)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// Read it back
	readFile, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if readFile.Meta.Project != "@personal" {
		t.Errorf("expected project @personal, got %q", readFile.Meta.Project)
	}
	if readFile.Meta.Date != "2026-01-30" {
		t.Errorf("expected date 2026-01-30, got %q", readFile.Meta.Date)
	}
	if len(readFile.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(readFile.Entries))
	}
	if readFile.Entries[0].Content != "Fix the auth bug" {
		t.Errorf("expected content %q, got %q", "Fix the auth bug", readFile.Entries[0].Content)
	}
}

func TestStore_WriteFile_OverwriteExisting(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create and write first version
	file1 := NewJournalFile("@personal", "2026-01-30")
	entry1 := NewJournalEntry("First entry", nil)
	file1.AppendEntry(entry1)
	if err := store.WriteFile("@personal", "2026-01-30", file1); err != nil {
		t.Fatalf("failed to write file1: %v", err)
	}

	// Create and write second version (overwrite)
	file2 := NewJournalFile("@personal", "2026-01-30")
	entry2 := NewJournalEntry("Second entry", nil)
	file2.AppendEntry(entry2)
	if err := store.WriteFile("@personal", "2026-01-30", file2); err != nil {
		t.Fatalf("failed to write file2: %v", err)
	}

	// Read and verify second version
	readFile, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if len(readFile.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(readFile.Entries))
	}
	if readFile.Entries[0].Content != "Second entry" {
		t.Errorf("expected %q, got %q", "Second entry", readFile.Entries[0].Content)
	}
}

func TestStore_ReadFile_Corrupted(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create the journal directory
	journalDir := filepath.Join(tmpDir, "projects", "@personal", "journal")
	if err := os.MkdirAll(journalDir, 0755); err != nil {
		t.Fatalf("failed to create journal dir: %v", err)
	}

	// Write corrupted JSON
	corruptedPath := filepath.Join(journalDir, "2026-01-30.json")
	if err := os.WriteFile(corruptedPath, []byte("{ invalid json }"), 0644); err != nil {
		t.Fatalf("failed to write corrupted file: %v", err)
	}

	// Reading corrupted file should return error
	_, err := store.ReadFile("@personal", "2026-01-30")
	if err == nil {
		t.Error("expected error for corrupted file")
	}
	if !strings.Contains(err.Error(), "unmarshal") && !strings.Contains(err.Error(), "invalid") {
		t.Errorf("expected unmarshal/invalid error, got: %v", err)
	}
}

func TestStore_ListDates(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create some journal files
	dates := []string{"2026-01-28", "2026-01-29", "2026-01-30"}
	for _, date := range dates {
		file := NewJournalFile("@personal", date)
		if err := store.WriteFile("@personal", date, file); err != nil {
			t.Fatalf("failed to write file for %s: %v", date, err)
		}
	}

	// List dates
	listedDates, err := store.ListDates("@personal")
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}

	if len(listedDates) != len(dates) {
		t.Errorf("expected %d dates, got %d", len(dates), len(listedDates))
	}

	// Verify all dates are present (order may vary)
	dateMap := make(map[string]bool)
	for _, d := range listedDates {
		dateMap[d] = true
	}
	for _, d := range dates {
		if !dateMap[d] {
			t.Errorf("expected date %s not found in list", d)
		}
	}
}

func TestStore_ListDates_NoJournalDir(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// List dates for project with no journal directory
	dates, err := store.ListDates("@nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(dates) != 0 {
		t.Errorf("expected 0 dates, got %d", len(dates))
	}
}

func TestStore_ListDates_IgnoresNonJournalFiles(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create journal directory
	journalDir := filepath.Join(tmpDir, "projects", "@personal", "journal")
	if err := os.MkdirAll(journalDir, 0755); err != nil {
		t.Fatalf("failed to create journal dir: %v", err)
	}

	// Create valid journal file
	file := NewJournalFile("@personal", "2026-01-30")
	if err := store.WriteFile("@personal", "2026-01-30", file); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// Create non-journal files that should be ignored
	if err := os.WriteFile(filepath.Join(journalDir, "notes.txt"), []byte("ignore me"), 0644); err != nil {
		t.Fatalf("failed to write notes.txt: %v", err)
	}
	if err := os.WriteFile(filepath.Join(journalDir, "invalid-date.json"), []byte("{}"), 0644); err != nil {
		t.Fatalf("failed to write invalid-date.json: %v", err)
	}

	dates, err := store.ListDates("@personal")
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}

	if len(dates) != 1 {
		t.Errorf("expected 1 date, got %d: %v", len(dates), dates)
	}
	if len(dates) > 0 && dates[0] != "2026-01-30" {
		t.Errorf("expected 2026-01-30, got %s", dates[0])
	}
}

func TestStore_DeleteFile(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create a journal file
	file := NewJournalFile("@personal", "2026-01-30")
	if err := store.WriteFile("@personal", "2026-01-30", file); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// Verify it exists
	_, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("file should exist: %v", err)
	}

	// Delete it
	if err := store.DeleteFile("@personal", "2026-01-30"); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}

	// Verify it's gone (should create new empty file when reading)
	readFile, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(readFile.Entries) != 0 {
		t.Errorf("expected empty journal after delete, got %d entries", len(readFile.Entries))
	}
}

func TestStore_Exists(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Should not exist initially
	if store.Exists("@personal", "2026-01-30") {
		t.Error("file should not exist initially")
	}

	// Create file
	file := NewJournalFile("@personal", "2026-01-30")
	if err := store.WriteFile("@personal", "2026-01-30", file); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// Should exist now
	if !store.Exists("@personal", "2026-01-30") {
		t.Error("file should exist after creation")
	}
}

func TestStore_ListDatesByYearMonth(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create journals across different months
	dates := []string{
		"2026-01-15",
		"2026-01-30",
		"2026-02-01",
		"2025-12-31",
	}
	for _, date := range dates {
		file := NewJournalFile("@personal", date)
		if err := store.WriteFile("@personal", date, file); err != nil {
			t.Fatalf("failed to write file for %s: %v", date, err)
		}
	}

	// List only January 2026
	janDates, err := store.ListDatesByYearMonth("@personal", 2026, 1)
	if err != nil {
		t.Fatalf("failed to list dates: %v", err)
	}

	if len(janDates) != 2 {
		t.Errorf("expected 2 dates for Jan 2026, got %d: %v", len(janDates), janDates)
	}
}

func TestStore_ReadFileMultipleEntries(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create file with multiple entries
	file := NewJournalFile("@personal", "2026-01-30")
	entry1 := NewJournalEntry("First entry", []string{"tag1"})
	entry2 := NewJournalEntry("Second entry", []string{"tag2", "tag3"})
	entry3 := NewJournalEntry("Third entry", nil)
	file.AppendEntry(entry1)
	file.AppendEntry(entry2)
	file.AppendEntry(entry3)

	if err := store.WriteFile("@personal", "2026-01-30", file); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	readFile, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if len(readFile.Entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(readFile.Entries))
	}

	// Verify entries
	if readFile.Entries[0].Content != "First entry" {
		t.Errorf("entry 0: expected %q, got %q", "First entry", readFile.Entries[0].Content)
	}
	if readFile.Entries[1].Content != "Second entry" {
		t.Errorf("entry 1: expected %q, got %q", "Second entry", readFile.Entries[1].Content)
	}
	if len(readFile.Entries[1].Tags) != 2 {
		t.Errorf("entry 1: expected 2 tags, got %d", len(readFile.Entries[1].Tags))
	}
}

func TestStore_PreservesTimestamps(t *testing.T) {
	v, tmpDir := setupTestVault(t)
	defer cleanupTestVault(tmpDir)

	store := NewStore(v)

	// Create file with specific timestamps
	created := time.Date(2026, 1, 30, 9, 15, 0, 0, time.UTC)
	updated := time.Date(2026, 1, 30, 14, 30, 0, 0, time.UTC)

	file := &JournalFile{
		Meta: JournalMeta{
			Project: "@personal",
			Date:    "2026-01-30",
			Created: created,
			Updated: updated,
		},
		Entries: []JournalEntry{},
	}

	if err := store.WriteFile("@personal", "2026-01-30", file); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	readFile, err := store.ReadFile("@personal", "2026-01-30")
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	// Compare timestamps (allowing for JSON serialization rounding)
	if !readFile.Meta.Created.Equal(created) {
		t.Errorf("created mismatch: expected %v, got %v", created, readFile.Meta.Created)
	}
	if !readFile.Meta.Updated.Equal(updated) {
		t.Errorf("updated mismatch: expected %v, got %v", updated, readFile.Meta.Updated)
	}
}
