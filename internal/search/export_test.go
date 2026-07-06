package search

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"yanta/internal/testutil"
)

func seedProject(t *testing.T, db *sql.DB, alias string) {
	t.Helper()
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO project (id, alias, name, start_date, end_date, created_at, updated_at)
		VALUES (?, ?, 'Test Project', '2024-01-01', '2024-12-31',
		        strftime('%Y-%m-%d %H:%M:%f','now'), strftime('%Y-%m-%d %H:%M:%f','now'))
	`, "proj-"+alias, alias)
	if err != nil {
		t.Fatalf("seed project: %v", err)
	}
}

func seedDoc(t *testing.T, db *sql.DB, path, alias, title string, deleted bool) {
	t.Helper()
	ctx := context.Background()
	var err error
	if deleted {
		_, err = db.ExecContext(ctx, `
			INSERT INTO doc (path, project_alias, title, mtime_ns, size_bytes, deleted_at)
			VALUES (?, ?, ?, 0, 0, strftime('%Y-%m-%d %H:%M:%f','now'))
		`, path, alias, title)
	} else {
		_, err = db.ExecContext(ctx, `
			INSERT INTO doc (path, project_alias, title, mtime_ns, size_bytes)
			VALUES (?, ?, ?, 0, 0)
		`, path, alias, title)
	}
	if err != nil {
		t.Fatalf("seed doc %s: %v", path, err)
	}
}

func TestService_ExportIndex(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	ctx := context.Background()
	store := NewStore(db)
	svc := NewService(db, nil)

	seedProject(t, db, "@work")

	// A live document with content in fts_doc.
	seedDoc(t, db, "projects/@work/systems.json", "@work", "System Design", false)
	if err := store.InsertDocument(ctx, "projects/@work/systems.json", "System Design", "Architecture", "the system handles books", "func main"); err != nil {
		t.Fatalf("insert fts_doc: %v", err)
	}

	// A soft-deleted document — must be excluded from the export.
	seedDoc(t, db, "projects/@work/old.json", "@work", "Old Deleted", true)
	if err := store.InsertDocument(ctx, "projects/@work/old.json", "Old Deleted", "", "secret body", ""); err != nil {
		t.Fatalf("insert deleted fts_doc: %v", err)
	}

	// A journal note.
	if err := store.InsertJournalEntry(ctx, "@work", "2026-07-06", "entry-1", "Meeting notes about booking", []string{"meeting"}); err != nil {
		t.Fatalf("insert journal: %v", err)
	}

	got, err := svc.ExportIndex(ctx)
	if err != nil {
		t.Fatalf("ExportIndex: %v", err)
	}

	byID := make(map[string]IndexDoc, len(got))
	for _, d := range got {
		byID[d.ID] = d
	}

	if _, ok := byID["projects/@work/old.json"]; ok {
		t.Error("soft-deleted document should be excluded from export")
	}

	doc, ok := byID["projects/@work/systems.json"]
	if !ok {
		t.Fatalf("exported document not found; got %d records", len(got))
	}
	if doc.Type != "document" {
		t.Errorf("Type = %q, want document", doc.Type)
	}
	if doc.Title != "System Design" || doc.Headings != "Architecture" ||
		doc.Body != "the system handles books" || doc.Code != "func main" {
		t.Errorf("document fields mismatch: %+v", doc)
	}
	if doc.ProjectAlias != "@work" {
		t.Errorf("ProjectAlias = %q, want @work", doc.ProjectAlias)
	}

	note, ok := byID["journal/@work/2026-07-06/entry-1"]
	if !ok {
		t.Fatalf("exported note not found")
	}
	if note.Type != "note" {
		t.Errorf("Type = %q, want note", note.Type)
	}
	if note.Body != "Meeting notes about booking" {
		t.Errorf("note Body = %q", note.Body)
	}
	if note.NoteID != "entry-1" {
		t.Errorf("note NoteID = %q, want entry-1", note.NoteID)
	}
	if !strings.Contains(note.Tags, "meeting") {
		t.Errorf("note Tags = %q, want to contain meeting", note.Tags)
	}
}
