package link

import (
	"context"
	"database/sql"
	"testing"
	"yanta/internal/testutil"
)

// insertTestDoc inserts a test document for foreign key constraints
func insertTestDoc(t *testing.T, db *sql.DB, path string) {
	t.Helper()

	// Insert test project if it doesn't exist
	_, _ = db.Exec(`INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test', 'Test Project')`)

	_, err := db.Exec(`
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes)
		VALUES (?, '@test', 1000000, 100)
	`, path)
	if err != nil {
		t.Fatalf("failed to insert test doc: %v", err)
	}
}

// ==================== AddLinks Tests ====================

func TestStore_AddLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	links := []*Link{
		{URL: "https://github.com/user/repo", Host: "github.com"},
		{URL: "https://example.com/page", Host: "example.com"},
	}

	err := store.AddLinks(ctx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Verify links were inserted
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 2 {
		t.Errorf("expected 2 links, got %d", count)
	}
}

func TestStore_AddLinks_Duplicate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	link := []*Link{{URL: "https://github.com", Host: "github.com"}}

	// Add link first time
	err := store.AddLinks(ctx, docPath, link)
	if err != nil {
		t.Fatalf("AddLinks() first call error: %v", err)
	}

	// Add same link again - should be idempotent
	err = store.AddLinks(ctx, docPath, link)
	if err != nil {
		t.Fatalf("AddLinks() second call error: %v", err)
	}

	// Verify only one link exists
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 1 {
		t.Errorf("expected 1 link after duplicate insert, got %d", count)
	}
}

func TestStore_AddLinks_EmptySlice(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// Adding empty slice should be no-op
	err := store.AddLinks(ctx, docPath, []*Link{})
	if err != nil {
		t.Fatalf("AddLinks() with empty slice error: %v", err)
	}
}

// ==================== RemoveLinks Tests ====================

func TestStore_RemoveLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// Add links first
	links := []*Link{
		{URL: "https://github.com", Host: "github.com"},
		{URL: "https://example.com", Host: "example.com"},
	}
	err := store.AddLinks(ctx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Remove one link
	toRemove := []string{"https://github.com"}
	err = store.RemoveLinks(ctx, docPath, toRemove)
	if err != nil {
		t.Fatalf("RemoveLinks() error: %v", err)
	}

	// Verify only one link remains
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 1 {
		t.Errorf("expected 1 link after removal, got %d", count)
	}

	// Verify the correct link remains
	var url string
	err = db.QueryRow("SELECT url FROM doc_link WHERE path = ?", docPath).Scan(&url)
	if err != nil {
		t.Fatalf("failed to get remaining link: %v", err)
	}

	if url != "https://example.com" {
		t.Errorf("expected remaining link to be example.com, got %s", url)
	}
}

// ==================== RemoveAllDocumentLinks Tests ====================

func TestStore_RemoveAllDocumentLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// Add links
	links := []*Link{
		{URL: "https://github.com", Host: "github.com"},
		{URL: "https://example.com", Host: "example.com"},
	}
	err := store.AddLinks(ctx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Remove all links
	err = store.RemoveAllDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("RemoveAllDocumentLinks() error: %v", err)
	}

	// Verify no links remain
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 0 {
		t.Errorf("expected 0 links after removal, got %d", count)
	}
}

// ==================== GetDocumentLinks Tests ====================

func TestStore_GetDocumentLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// Add links
	links := []*Link{
		{URL: "https://github.com/user/repo", Host: "github.com"},
		{URL: "https://example.com/page", Host: "example.com"},
	}
	err := store.AddLinks(ctx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Get links
	retrieved, err := store.GetDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("GetDocumentLinks() error: %v", err)
	}

	if len(retrieved) != 2 {
		t.Fatalf("expected 2 links, got %d", len(retrieved))
	}

	// Verify link contents
	expectedURLs := map[string]string{
		"https://github.com/user/repo": "github.com",
		"https://example.com/page":     "example.com",
	}

	for _, link := range retrieved {
		expectedHost, ok := expectedURLs[link.URL]
		if !ok {
			t.Errorf("unexpected URL: %s", link.URL)
			continue
		}

		if link.Host != expectedHost {
			t.Errorf("URL %s: expected host %s, got %s", link.URL, expectedHost, link.Host)
		}
	}
}

func TestStore_GetDocumentLinks_NoLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// Get links for document with no links
	links, err := store.GetDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("GetDocumentLinks() error: %v", err)
	}

	if len(links) != 0 {
		t.Errorf("expected 0 links, got %d", len(links))
	}
}

// ==================== GetLinksByHost Tests ====================

func TestStore_GetLinksByHost(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	// Create two documents
	doc1 := "projects/@test/doc-001.json"
	doc2 := "projects/@test/doc-002.json"
	insertTestDoc(t, db, doc1)
	insertTestDoc(t, db, doc2)

	// Add links to doc1
	err := store.AddLinks(ctx, doc1, []*Link{
		{URL: "https://github.com/user/repo1", Host: "github.com"},
		{URL: "https://example.com/page1", Host: "example.com"},
	})
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Add links to doc2
	err = store.AddLinks(ctx, doc2, []*Link{
		{URL: "https://github.com/user/repo2", Host: "github.com"},
		{URL: "https://gitlab.com/project", Host: "gitlab.com"},
	})
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Get github.com links
	githubLinks, err := store.GetLinksByHost(ctx, "github.com")
	if err != nil {
		t.Fatalf("GetLinksByHost() error: %v", err)
	}

	if len(githubLinks) != 2 {
		t.Errorf("expected 2 github.com links, got %d", len(githubLinks))
	}

	// Verify both documents are represented
	docs := make(map[string]bool)
	for _, link := range githubLinks {
		docs[link.DocPath] = true
	}

	if !docs[doc1] || !docs[doc2] {
		t.Errorf("expected links from both documents")
	}
}

// ==================== CountDocumentLinks Tests ====================

func TestStore_CountDocumentLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	// No links initially
	count, err := store.CountDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("CountDocumentLinks() error: %v", err)
	}

	if count != 0 {
		t.Errorf("expected 0 links initially, got %d", count)
	}

	// Add links
	links := []*Link{
		{URL: "https://github.com", Host: "github.com"},
		{URL: "https://example.com", Host: "example.com"},
		{URL: "https://gitlab.com", Host: "gitlab.com"},
	}
	err = store.AddLinks(ctx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinks() error: %v", err)
	}

	// Count again
	count, err = store.CountDocumentLinks(ctx, docPath)
	if err != nil {
		t.Fatalf("CountDocumentLinks() error: %v", err)
	}

	if count != 3 {
		t.Errorf("expected 3 links, got %d", count)
	}
}

// ==================== Transaction Tests ====================

func TestStore_AddLinksTx(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	links := []*Link{
		{URL: "https://github.com", Host: "github.com"},
	}

	err = store.AddLinksTx(ctx, tx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinksTx() error: %v", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify link was added
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 1 {
		t.Errorf("expected 1 link, got %d", count)
	}
}

func TestStore_Transaction_Rollback(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	docPath := "projects/@test/doc-001.json"
	insertTestDoc(t, db, docPath)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin transaction: %v", err)
	}

	links := []*Link{
		{URL: "https://github.com", Host: "github.com"},
	}

	err = store.AddLinksTx(ctx, tx, docPath, links)
	if err != nil {
		t.Fatalf("AddLinksTx() error: %v", err)
	}

	// Rollback instead of commit
	tx.Rollback()

	// Verify link was NOT added
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM doc_link WHERE path = ?", docPath).Scan(&count)
	if err != nil {
		t.Fatalf("failed to count links: %v", err)
	}

	if count != 0 {
		t.Errorf("expected 0 links after rollback, got %d", count)
	}
}
