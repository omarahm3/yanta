package document

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yanta/internal/vault"
)


func setupTestVault(t *testing.T) *vault.Vault {
	t.Helper()
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create test vault: %v", err)
	}
	return v
}

func TestFileReader_ReadFile(t *testing.T) {
	v := setupTestVault(t)
	reader := NewFileReader(v)
	writer := NewFileWriter(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	doc := NewDocumentFile(projectAlias, "Test Document", []string{"test"})
	relativePath := "projects/@test-project/doc-test123.json"

	if err := writer.WriteFile(relativePath, doc); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	readDoc, err := reader.ReadFile(relativePath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if readDoc.Meta.Project != projectAlias {
		t.Errorf("Project = %q, want %q", readDoc.Meta.Project, projectAlias)
	}
	if readDoc.Meta.Title != "Test Document" {
		t.Errorf("Title = %q, want %q", readDoc.Meta.Title, "Test Document")
	}
}

func TestFileReader_ReadFile_NotFound(t *testing.T) {
	v := setupTestVault(t)
	reader := NewFileReader(v)

	_, err := reader.ReadFile("projects/@test-project/doc-notfound.json")
	if err == nil {
		t.Fatal("ReadFile() should fail for non-existent file")
	}

	if !errors.Is(err, ErrNotFound) {
		t.Errorf("ReadFile() error should be ErrNotFound, got %v", err)
	}
}

func TestFileReader_ReadFile_Corrupted(t *testing.T) {
	v := setupTestVault(t)
	reader := NewFileReader(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	relativePath := "projects/@test-project/doc-corrupt.json"
	absPath, _ := v.DocumentPath(relativePath)
	if err := os.WriteFile(absPath, []byte("invalid json {{{"), 0644); err != nil {
		t.Fatalf("Failed to write corrupt file: %v", err)
	}

	_, err := reader.ReadFile(relativePath)
	if err == nil {
		t.Fatal("ReadFile() should fail for corrupted file")
	}

	if !errors.Is(err, ErrCorrupted) {
		t.Errorf("ReadFile() error should be ErrCorrupted, got %v", err)
	}
}

func TestFileWriter_WriteFile(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	doc := NewDocumentFile(projectAlias, "New Document", []string{"test", "new"})
	doc.Blocks = []BlockNoteBlock{
		{
			ID:      "block1",
			Type:    "heading",
			Props:   map[string]any{"level": 1},
			Content: mustMarshalContent([]BlockNoteContent{{Type: "text", Text: "Title"}}),
		},
	}

	relativePath := "projects/@test-project/doc-new123.json"

	if err := writer.WriteFile(relativePath, doc); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	absPath, _ := v.DocumentPath(relativePath)
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		t.Error("File was not created")
	}

	reader := NewFileReader(v)
	readDoc, err := reader.ReadFile(relativePath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if readDoc.Meta.Title != "New Document" {
		t.Errorf("Title = %q, want %q", readDoc.Meta.Title, "New Document")
	}
	if len(readDoc.Blocks) != 1 {
		t.Errorf("Blocks length = %d, want 1", len(readDoc.Blocks))
	}
}

func TestFileWriter_WriteFile_InvalidDocument(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "",
			Title:   "Test",
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{},
	}

	relativePath := "projects/@test-project/doc-invalid.json"

	err := writer.WriteFile(relativePath, doc)
	if err == nil {
		t.Fatal("WriteFile() should fail for invalid document")
	}

	if !errors.Is(err, ErrValidation) {
		t.Errorf("WriteFile() error should be ErrValidation, got %v", err)
	}
}

func TestFileWriter_UpdateFile(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)
	reader := NewFileReader(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	doc := NewDocumentFile(projectAlias, "Original Title", []string{"tag1"})
	relativePath := "projects/@test-project/doc-update123.json"

	if err := writer.WriteFile(relativePath, doc); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	original, _ := reader.ReadFile(relativePath)
	originalUpdated := original.Meta.Updated

	time.Sleep(10 * time.Millisecond)

	err := writer.UpdateFile(relativePath, func(d *DocumentFile) error {
		d.Meta.Title = "Updated Title"
		d.Meta.Tags = append(d.Meta.Tags, "tag2")
		return nil
	})
	if err != nil {
		t.Fatalf("UpdateFile() error = %v", err)
	}

	updated, err := reader.ReadFile(relativePath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if updated.Meta.Title != "Updated Title" {
		t.Errorf("Title = %q, want %q", updated.Meta.Title, "Updated Title")
	}
	if len(updated.Meta.Tags) != 2 {
		t.Errorf("Tags length = %d, want 2", len(updated.Meta.Tags))
	}

	if !updated.Meta.Updated.After(originalUpdated) {
		t.Errorf("Updated timestamp not changed: original=%v, updated=%v",
			originalUpdated, updated.Meta.Updated)
	}
}

func TestFileWriter_UpdateFile_NotFound(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)

	err := writer.UpdateFile("projects/@test-project/doc-notfound.json", func(d *DocumentFile) error {
		return nil
	})

	if !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateFile() error should be ErrNotFound, got %v", err)
	}
}

func TestFileWriter_DeleteFile(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)
	reader := NewFileReader(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	doc := NewDocumentFile(projectAlias, "To Delete", []string{})
	relativePath := "projects/@test-project/doc-delete123.json"

	if err := writer.WriteFile(relativePath, doc); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	exists, _ := reader.FileExists(relativePath)
	if !exists {
		t.Fatal("File should exist before deletion")
	}

	if err := writer.DeleteFile(relativePath); err != nil {
		t.Fatalf("DeleteFile() error = %v", err)
	}

	exists, _ = reader.FileExists(relativePath)
	if exists {
		t.Error("File should not exist after deletion")
	}
}

func TestFileWriter_DeleteFile_NotFound(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)

	err := writer.DeleteFile("projects/@test-project/doc-notfound.json")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("DeleteFile() error should be ErrNotFound, got %v", err)
	}
}

func TestFileLister_ListFiles(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)
	lister := NewFileLister(v)

	projectAlias := "@test-project"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	docs := []string{"doc-001.json", "doc-002.json", "doc-003.json"}
	for _, docName := range docs {
		doc := NewDocumentFile(projectAlias, docName, []string{})
		relativePath := path.Join("projects", projectAlias, docName)

		if err := writer.WriteFile(relativePath, doc); err != nil {
			t.Fatalf("WriteFile() error = %v", err)
		}
	}

	paths, err := lister.ListFiles(projectAlias)
	if err != nil {
		t.Fatalf("ListFiles() error = %v", err)
	}

	if len(paths) != len(docs) {
		t.Errorf("ListFiles() returned %d files, want %d", len(paths), len(docs))
	}

	for _, expectedDoc := range docs {
		found := false
		for _, path := range paths {
			if strings.HasSuffix(path, expectedDoc) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("ListFiles() missing expected file: %s", expectedDoc)
		}
	}
}

func TestFileLister_ListFiles_EmptyProject(t *testing.T) {
	v := setupTestVault(t)
	lister := NewFileLister(v)

	paths, err := lister.ListFiles("@nonexistent-project")
	if err != nil {
		t.Fatalf("ListFiles() error = %v", err)
	}

	if len(paths) != 0 {
		t.Errorf("ListFiles() returned %d files for non-existent project, want 0", len(paths))
	}
}

func TestFileLister_ListFilesRecursive(t *testing.T) {
	v := setupTestVault(t)
	writer := NewFileWriter(v)
	lister := NewFileLister(v)

	projects := []string{"@project-a", "@project-b", "@project-c"}
	totalDocs := 0

	for _, proj := range projects {
		if err := v.EnsureProjectDir(proj); err != nil {
			t.Fatalf("Failed to create project dir: %v", err)
		}

		for i := 1; i <= 2; i++ {
			doc := NewDocumentFile(proj, "Doc", []string{})
			relativePath := path.Join("projects", proj, fmt.Sprintf("doc-%03d.json", i))

			if err := writer.WriteFile(relativePath, doc); err != nil {
				t.Fatalf("WriteFile() error = %v", err)
			}
			totalDocs++
		}
	}

	allPaths, err := lister.ListFilesRecursive()
	if err != nil {
		t.Fatalf("ListFilesRecursive() error = %v", err)
	}

	if len(allPaths) != totalDocs {
		t.Errorf("ListFilesRecursive() returned %d files, want %d", len(allPaths), totalDocs)
	}

	for _, proj := range projects {
		found := false
		for _, path := range allPaths {
			if strings.Contains(path, proj) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("ListFilesRecursive() missing files from project: %s", proj)
		}
	}
}

func TestWriteFileAtomic(t *testing.T) {
	tempDir := t.TempDir()
	targetPath := filepath.Join(tempDir, "test.json")
	testData := []byte(`{"test": "data"}`)

	if err := writeFileAtomic(targetPath, testData); err != nil {
		t.Fatalf("writeFileAtomic() error = %v", err)
	}

	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		t.Error("File was not created")
	}

	readData, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("Failed to read file: %v", err)
	}

	if string(readData) != string(testData) {
		t.Errorf("File content = %q, want %q", string(readData), string(testData))
	}

	entries, _ := os.ReadDir(tempDir)
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".tmp-") {
			t.Errorf("Temp file left behind: %s", entry.Name())
		}
	}
}

func TestFileManager_Integration(t *testing.T) {
	v := setupTestVault(t)
	manager := NewFileManager(v)

	projectAlias := "@integration-test"
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project dir: %v", err)
	}

	doc := NewDocumentFile(projectAlias, "Integration Test", []string{"test"})
	relativePath := "projects/@integration-test/doc-int123.json"

	if err := manager.WriteFile(relativePath, doc); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	readDoc, err := manager.ReadFile(relativePath)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if readDoc.Meta.Title != "Integration Test" {
		t.Errorf("Title mismatch")
	}

	err = manager.UpdateFile(relativePath, func(d *DocumentFile) error {
		d.Meta.Title = "Updated via Manager"
		return nil
	})
	if err != nil {
		t.Fatalf("UpdateFile() error = %v", err)
	}

	paths, err := manager.ListFiles(projectAlias)
	if err != nil {
		t.Fatalf("ListFiles() error = %v", err)
	}

	if len(paths) != 1 {
		t.Errorf("ListFiles() returned %d files, want 1", len(paths))
	}

	if err := manager.DeleteFile(relativePath); err != nil {
		t.Fatalf("DeleteFile() error = %v", err)
	}

	exists, _ := manager.FileExists(relativePath)
	if exists {
		t.Error("File should not exist after deletion")
	}
}
