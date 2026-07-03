package mcp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeVault is a configurable in-memory Vault for tests.
type fakeVault struct {
	hits     []SearchHit
	projects []ProjectInfo
	docs     []DocumentInfo
	doc      DocumentContent
	entries  []JournalEntryInfo
	dates    []string
	tags     []string
	err      error

	createdAlias, createdTitle, createdMD string
	createdTags                           []string
	updatedPath                           string
	updatedTitle, updatedMD               *string
	updatedTags                           *[]string
}

func (f *fakeVault) SearchNotes(_ context.Context, _ string, _, _ int) ([]SearchHit, error) {
	return f.hits, f.err
}
func (f *fakeVault) ListProjects(_ context.Context, _ bool) ([]ProjectInfo, error) {
	return f.projects, f.err
}
func (f *fakeVault) ListDocuments(_ context.Context, _ string, _ bool, _, _ int) ([]DocumentInfo, error) {
	return f.docs, f.err
}
func (f *fakeVault) GetDocument(_ context.Context, _ string) (DocumentContent, error) {
	return f.doc, f.err
}
func (f *fakeVault) ReadJournal(_ context.Context, _, _ string) ([]JournalEntryInfo, error) {
	return f.entries, f.err
}
func (f *fakeVault) ListJournalDates(_ context.Context, _ string) ([]string, error) {
	return f.dates, f.err
}
func (f *fakeVault) ListTags(_ context.Context) ([]string, error) {
	return f.tags, f.err
}
func (f *fakeVault) CreateDocument(_ context.Context, alias, title, md string, tags []string) (string, error) {
	f.createdAlias, f.createdTitle, f.createdMD, f.createdTags = alias, title, md, tags
	if f.err != nil {
		return "", f.err
	}
	return "projects/@" + alias + "/doc-new.json", nil
}
func (f *fakeVault) UpdateDocument(_ context.Context, path string, title, md *string, tags *[]string) error {
	f.updatedPath, f.updatedTitle, f.updatedMD, f.updatedTags = path, title, md, tags
	return f.err
}
func (f *fakeVault) MoveDocument(_ context.Context, _, _ string) error        { return f.err }
func (f *fakeVault) DeleteDocument(_ context.Context, _ string, _ bool) error { return f.err }
func (f *fakeVault) AppendJournal(_ context.Context, _, content string, tags []string, _ string) (JournalEntryInfo, error) {
	if f.err != nil {
		return JournalEntryInfo{}, f.err
	}
	return JournalEntryInfo{ID: "abc123", Content: content, Tags: tags, Created: "2026-07-03T00:00:00Z"}, nil
}
func (f *fakeVault) AddTagsToDocument(_ context.Context, _ string, _ []string) error { return f.err }
func (f *fakeVault) RemoveTagsFromDocument(_ context.Context, _ string, _ []string) error {
	return f.err
}

// TestNewServerRegistersTools ensures the SDK can infer JSON schemas for every
// tool's argument type (this is where a bad type — e.g. the *[]string patch
// field on update_document — would blow up at registration time).
func TestNewServerRegistersTools(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("NewServer panicked (schema inference failure?): %v", r)
		}
	}()
	if s := NewServer(&fakeVault{}, "test"); s == nil || s.srv == nil {
		t.Fatal("NewServer returned nil")
	}
}

func TestHandleSearch(t *testing.T) {
	fv := &fakeVault{hits: []SearchHit{{ID: "1", Title: "a"}, {ID: "2", Title: "b"}}}
	s := NewServer(fv, "test")

	_, out, err := s.handleSearch(context.Background(), nil, searchArgs{Query: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Hits) != 2 {
		t.Fatalf("got %d hits, want 2", len(out.Hits))
	}

	if _, _, err := s.handleSearch(context.Background(), nil, searchArgs{Query: ""}); err == nil {
		t.Error("expected error for empty query")
	}

	fv.err = errors.New("boom")
	if _, _, err := s.handleSearch(context.Background(), nil, searchArgs{Query: "x"}); err == nil {
		t.Error("expected vault error to propagate")
	}
}

func TestHandleCreateDocument(t *testing.T) {
	fv := &fakeVault{}
	s := NewServer(fv, "test")

	_, ref, err := s.handleCreateDocument(context.Background(), nil, createDocumentArgs{
		ProjectAlias: "work", Title: "Note", Markdown: "# Hi", Tags: []string{"x"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if fv.createdAlias != "work" || fv.createdTitle != "Note" || fv.createdMD != "# Hi" {
		t.Errorf("create not forwarded: %+v", fv)
	}
	if ref.Path == "" {
		t.Error("expected a path in the result")
	}

	if _, _, err := s.handleCreateDocument(context.Background(), nil, createDocumentArgs{Title: "x"}); err == nil {
		t.Error("expected error when project_alias missing")
	}
}

func TestHandleUpdateDocument_RequiresAField(t *testing.T) {
	s := NewServer(&fakeVault{}, "test")
	if _, _, err := s.handleUpdateDocument(context.Background(), nil, updateDocumentArgs{Path: "p"}); err == nil {
		t.Error("expected error when no fields provided")
	}

	fv := &fakeVault{}
	s = NewServer(fv, "test")
	title := "New Title"
	if _, _, err := s.handleUpdateDocument(context.Background(), nil, updateDocumentArgs{Path: "p", Title: &title}); err != nil {
		t.Fatal(err)
	}
	if fv.updatedPath != "p" || fv.updatedTitle == nil || *fv.updatedTitle != "New Title" {
		t.Errorf("update not forwarded correctly: %+v", fv)
	}
	if fv.updatedMD != nil || fv.updatedTags != nil {
		t.Error("omitted fields should stay nil")
	}
}

func TestHandleAppendJournal(t *testing.T) {
	s := NewServer(&fakeVault{}, "test")
	_, entry, err := s.handleAppendJournal(context.Background(), nil, appendJournalArgs{ProjectAlias: "work", Content: "did a thing"})
	if err != nil {
		t.Fatal(err)
	}
	if entry.ID == "" || entry.Content != "did a thing" {
		t.Errorf("unexpected entry: %+v", entry)
	}

	if _, _, err := s.handleAppendJournal(context.Background(), nil, appendJournalArgs{ProjectAlias: "work"}); err == nil {
		t.Error("expected error for empty content")
	}
}

func TestWithAuth(t *testing.T) {
	const token = "secret-token"
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	h := withAuth(ok, token)

	cases := []struct {
		name     string
		auth     string
		origin   string
		wantCode int
	}{
		{"valid token, no origin", "Bearer secret-token", "", http.StatusOK},
		{"missing token", "", "", http.StatusUnauthorized},
		{"wrong token", "Bearer nope", "", http.StatusUnauthorized},
		{"loopback origin ok", "Bearer secret-token", "http://127.0.0.1:5173", http.StatusOK},
		{"localhost origin ok", "Bearer secret-token", "http://localhost:3000", http.StatusOK},
		{"remote origin rejected", "Bearer secret-token", "https://evil.example.com", http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", nil)
			if tc.auth != "" {
				req.Header.Set("Authorization", tc.auth)
			}
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != tc.wantCode {
				t.Errorf("got %d, want %d", rec.Code, tc.wantCode)
			}
		})
	}
}
