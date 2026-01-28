package document

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestVaultForExport(t *testing.T) *vault.Vault {
	t.Helper()
	tempDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create test vault: %v", err)
	}
	return v
}

func TestExportDocument(t *testing.T) {
	// Create test vault
	v := setupTestVaultForExport(t)

	// Create test document
	docPath := "projects/@test/doc-test123.json"
	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test Document",
			Tags:    []string{"test", "export"},
			Created: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
			Updated: time.Date(2024, 1, 2, 12, 0, 0, 0, time.UTC),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Hello World"},
				}),
			},
			{
				ID:   "2",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is a test document."},
				}),
			},
		},
	}

	fm := NewFileManager(v)
	err := fm.WriteFile(docPath, doc)
	require.NoError(t, err)

	// Create exporter
	exporter := NewExporter(v)

	// Create output directory
	outputDir := filepath.Join(t.TempDir(), "export")
	outputPath := filepath.Join(outputDir, "test-document.md")

	// Export document
	err = exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	})
	require.NoError(t, err)

	// Verify file exists
	_, err = os.Stat(outputPath)
	require.NoError(t, err)

	// Read exported file
	content, err := os.ReadFile(outputPath)
	require.NoError(t, err)

	markdown := string(content)

	// Verify frontmatter
	assert.Contains(t, markdown, "---")
	assert.Contains(t, markdown, "title: Test Document")
	assert.Contains(t, markdown, "project: @test")
	assert.Contains(t, markdown, "tags:")
	assert.Contains(t, markdown, "  - test")
	assert.Contains(t, markdown, "  - export")

	// Verify content
	assert.Contains(t, markdown, "# Hello World")
	assert.Contains(t, markdown, "This is a test document.")
}

func TestExportDocument_MissingDocumentPath(t *testing.T) {
	v := setupTestVaultForExport(t)
	exporter := NewExporter(v)

	err := exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: "",
		OutputPath:   "/tmp/test.md",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "document path is required")
}

func TestExportDocument_MissingOutputPath(t *testing.T) {
	v := setupTestVaultForExport(t)
	exporter := NewExporter(v)

	err := exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: "projects/@test/doc-test.json",
		OutputPath:   "",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "output path is required")
}

func TestExportDocument_DocumentNotFound(t *testing.T) {
	v := setupTestVaultForExport(t)
	exporter := NewExporter(v)
	outputPath := filepath.Join(t.TempDir(), "nonexistent.md")

	err := exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: "projects/@test/doc-nonexistent.json",
		OutputPath:   outputPath,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "reading document")
}

func TestExportDocument_CreatesOutputDirectory(t *testing.T) {
	// Create test vault
	v := setupTestVaultForExport(t)

	// Create test document
	docPath := "projects/@test/doc-test456.json"
	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test Document",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Test content"},
				}),
			},
		},
	}

	fm := NewFileManager(v)
	err := fm.WriteFile(docPath, doc)
	require.NoError(t, err)

	// Create exporter
	exporter := NewExporter(v)

	// Use nested directory that doesn't exist
	outputPath := filepath.Join(t.TempDir(), "deeply", "nested", "path", "test.md")

	// Export document
	err = exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	})
	require.NoError(t, err)

	// Verify file exists and directory was created
	_, err = os.Stat(outputPath)
	require.NoError(t, err)

	// Verify content
	content, err := os.ReadFile(outputPath)
	require.NoError(t, err)
	assert.Contains(t, string(content), "Test content")
}

func TestExportDocument_ComplexDocument(t *testing.T) {
	// Create test vault
	v := setupTestVaultForExport(t)

	// Create complex document with various block types
	docPath := "projects/@test/doc-complex.json"
	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Complex Document",
			Tags:    []string{"markdown", "export", "test"},
			Aliases: []string{"complex-doc", "test-doc"},
			Created: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
			Updated: time.Date(2024, 1, 2, 12, 0, 0, 0, time.UTC),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Main Heading"},
				}),
			},
			{
				ID:   "2",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is ", Styles: map[string]any{}},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
					{Type: "text", Text: " and ", Styles: map[string]any{}},
					{Type: "text", Text: "italic", Styles: map[string]any{"italic": true}},
					{Type: "text", Text: " text.", Styles: map[string]any{}},
				}),
			},
			{
				ID:   "3",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "First item"},
				}),
			},
			{
				ID:   "4",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Second item"},
				}),
			},
			{
				ID:   "5",
				Type: "codeBlock",
				Props: map[string]any{
					"language": "go",
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "func main() {\n\tfmt.Println(\"Hello\")\n}"},
				}),
			},
		},
	}

	fm := NewFileManager(v)
	err := fm.WriteFile(docPath, doc)
	require.NoError(t, err)

	// Create exporter
	exporter := NewExporter(v)
	outputPath := filepath.Join(t.TempDir(), "complex.md")

	// Export document
	err = exporter.ExportDocument(ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	})
	require.NoError(t, err)

	// Read exported file
	content, err := os.ReadFile(outputPath)
	require.NoError(t, err)
	markdown := string(content)

	// Verify frontmatter with aliases
	assert.Contains(t, markdown, "title: Complex Document")
	assert.Contains(t, markdown, "aliases:")
	assert.Contains(t, markdown, "  - complex-doc")
	assert.Contains(t, markdown, "  - test-doc")

	// Verify content formatting
	assert.Contains(t, markdown, "# Main Heading")
	assert.Contains(t, markdown, "**bold**")
	assert.Contains(t, markdown, "*italic*")
	assert.Contains(t, markdown, "- First item")
	assert.Contains(t, markdown, "- Second item")
	assert.Contains(t, markdown, "```go")
	assert.Contains(t, markdown, "func main()")

	// Verify proper structure
	lines := strings.Split(markdown, "\n")
	assert.True(t, len(lines) > 10, "markdown should have multiple lines")
}
