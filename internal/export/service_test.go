package export

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"yanta/internal/document"
	"yanta/internal/logger"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMain ensures logger cleanup after all tests complete
// This prevents file handle leaks that cause test hangs
func TestMain(m *testing.M) {
	// Run all tests
	code := m.Run()

	// Close logger file handle to prevent hang
	// Must be called before os.Exit() as defer doesn't work with os.Exit()
	logger.Close()

	os.Exit(code)
}

type mockDocumentProvider struct {
	doc *document.DocumentWithTags
	err error
}

func (m *mockDocumentProvider) Get(ctx context.Context, path string) (*document.DocumentWithTags, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.doc, nil
}

type mockVaultProvider struct {
	rootPath   string
	assetsPath string
}

func (m *mockVaultProvider) RootPath() string {
	return m.rootPath
}

func (m *mockVaultProvider) DocumentPath(relativePath string) (string, error) {
	return filepath.Join(m.rootPath, relativePath), nil
}

func (m *mockVaultProvider) AssetsPath(projectAlias string) string {
	if m.assetsPath != "" {
		return m.assetsPath
	}
	return filepath.Join(m.rootPath, "assets", projectAlias)
}

func mustMarshalContent(content []document.BlockNoteContent) json.RawMessage {
	data, err := json.Marshal(content)
	if err != nil {
		panic(err)
	}
	return data
}

func setupServiceTest(t *testing.T) (*Service, *mockDocumentProvider, *mockVaultProvider) {
	tmpDir := t.TempDir()

	mockDoc := &mockDocumentProvider{}
	mockVault := &mockVaultProvider{
		rootPath:   tmpDir,
		assetsPath: filepath.Join(tmpDir, "assets", "@test"),
	}

	service := NewService(ServiceConfig{
		DocumentService: mockDoc,
		Vault:           mockVault,
	})

	return service, mockDoc, mockVault
}

func TestNewService(t *testing.T) {
	tmpDir := t.TempDir()

	mockDoc := &mockDocumentProvider{}
	mockVault := &mockVaultProvider{rootPath: tmpDir}

	service := NewService(ServiceConfig{
		DocumentService: mockDoc,
		Vault:           mockVault,
	})

	require.NotNil(t, service)
	assert.NotNil(t, service.docService)
	assert.NotNil(t, service.vault)
}

func TestService_ExportToPDF_Success(t *testing.T) {
	service, mockDoc, _ := setupServiceTest(t)
	ctx := context.Background()

	// Setup mock document
	mockDoc.doc = &document.DocumentWithTags{
		Document: &document.Document{
			Path:         "projects/@test/doc-123.json",
			ProjectAlias: "@test",
			Title:        "Test Document",
		},
		File: &document.DocumentFile{
			Meta: document.DocumentMeta{
				Title:   "Test Document",
				Project: "@test",
			},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   "block1",
					Type: "heading",
					Props: map[string]any{
						"level": float64(1),
					},
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "Hello World"},
					}),
				},
				{
					ID:   "block2",
					Type: "paragraph",
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "This is a test paragraph."},
					}),
				},
			},
		},
		Tags: []string{"test", "sample"},
	}

	outputPath := filepath.Join(t.TempDir(), "output.pdf")

	req := ExportRequest{
		DocumentPath: "projects/@test/doc-123.json",
		OutputPath:   outputPath,
	}

	err := service.ExportToPDF(ctx, req)
	require.NoError(t, err, "ExportToPDF() should succeed")

	// Verify output file exists
	_, err = os.Stat(outputPath)
	assert.NoError(t, err, "Output PDF file should exist")
}

func TestService_ExportToPDF_EmptyDocumentPath(t *testing.T) {
	service, _, _ := setupServiceTest(t)
	ctx := context.Background()

	req := ExportRequest{
		DocumentPath: "",
		OutputPath:   "/tmp/output.pdf",
	}

	err := service.ExportToPDF(ctx, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "document path is required")
}

func TestService_ExportToPDF_EmptyOutputPath(t *testing.T) {
	service, _, _ := setupServiceTest(t)
	ctx := context.Background()

	req := ExportRequest{
		DocumentPath: "projects/@test/doc-123.json",
		OutputPath:   "",
	}

	err := service.ExportToPDF(ctx, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "output path is required")
}

func TestService_ExportToPDF_WhitespaceOnlyPaths(t *testing.T) {
	service, _, _ := setupServiceTest(t)
	ctx := context.Background()

	tests := []struct {
		name         string
		documentPath string
		outputPath   string
		expectedErr  string
	}{
		{
			name:         "whitespace document path",
			documentPath: "   ",
			outputPath:   "/tmp/output.pdf",
			expectedErr:  "document path is required",
		},
		{
			name:         "whitespace output path",
			documentPath: "projects/@test/doc-123.json",
			outputPath:   "   ",
			expectedErr:  "output path is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := ExportRequest{
				DocumentPath: tt.documentPath,
				OutputPath:   tt.outputPath,
			}

			err := service.ExportToPDF(ctx, req)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestService_ExportToPDF_UninitializedService(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name    string
		service *Service
	}{
		{
			name:    "nil document service",
			service: &Service{docService: nil, vault: &mockVaultProvider{}},
		},
		{
			name:    "nil vault",
			service: &Service{docService: &mockDocumentProvider{}, vault: nil},
		},
		{
			name:    "both nil",
			service: &Service{docService: nil, vault: nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := ExportRequest{
				DocumentPath: "projects/@test/doc-123.json",
				OutputPath:   "/tmp/output.pdf",
			}

			err := tt.service.ExportToPDF(ctx, req)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "service not initialised correctly")
		})
	}
}

func TestService_ExportToPDF_DocumentNotFound(t *testing.T) {
	service, mockDoc, _ := setupServiceTest(t)
	ctx := context.Background()

	// Setup mock to return error
	mockDoc.err = assert.AnError

	outputPath := filepath.Join(t.TempDir(), "output.pdf")

	req := ExportRequest{
		DocumentPath: "projects/@test/nonexistent.json",
		OutputPath:   outputPath,
	}

	err := service.ExportToPDF(ctx, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "getting document")
}

func TestService_ExportToPDF_NilDocumentFile(t *testing.T) {
	service, mockDoc, _ := setupServiceTest(t)
	ctx := context.Background()

	// Setup mock document with nil file
	mockDoc.doc = &document.DocumentWithTags{
		Document: &document.Document{
			Path:         "projects/@test/doc-123.json",
			ProjectAlias: "@test",
			Title:        "Test Document",
		},
		File: nil,
		Tags: []string{"test"},
	}

	outputPath := filepath.Join(t.TempDir(), "output.pdf")

	req := ExportRequest{
		DocumentPath: "projects/@test/doc-123.json",
		OutputPath:   outputPath,
	}

	err := service.ExportToPDF(ctx, req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "document file is nil")
}

func TestService_ExportToPDF_WithMultipleBlockTypes(t *testing.T) {
	service, mockDoc, _ := setupServiceTest(t)
	ctx := context.Background()

	// Setup mock document with various block types
	mockDoc.doc = &document.DocumentWithTags{
		Document: &document.Document{
			Path:         "projects/@test/doc-123.json",
			ProjectAlias: "@test",
			Title:        "Complex Document",
		},
		File: &document.DocumentFile{
			Meta: document.DocumentMeta{
				Title:   "Complex Document",
				Project: "@test",
			},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   "h1",
					Type: "heading",
					Props: map[string]any{
						"level": float64(1),
					},
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "Main Heading"},
					}),
				},
				{
					ID:   "p1",
					Type: "paragraph",
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "Paragraph text"},
					}),
				},
				{
					ID:   "code1",
					Type: "codeBlock",
					Props: map[string]any{
						"language": "go",
					},
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "func main() {\n\tfmt.Println(\"Hello\")\n}"},
					}),
				},
				{
					ID:   "bullet1",
					Type: "bulletListItem",
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "Bullet point"},
					}),
				},
				{
					ID:   "quote1",
					Type: "quote",
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "This is a quote"},
					}),
				},
			},
		},
		Tags: []string{"complex", "test"},
	}

	outputPath := filepath.Join(t.TempDir(), "complex.pdf")

	req := ExportRequest{
		DocumentPath: "projects/@test/doc-123.json",
		OutputPath:   outputPath,
	}

	err := service.ExportToPDF(ctx, req)
	require.NoError(t, err, "ExportToPDF() should succeed with multiple block types")

	// Verify output file exists
	_, err = os.Stat(outputPath)
	assert.NoError(t, err, "Output PDF file should exist")
}

func TestService_ExportToPDF_CreatesOutputDirectory(t *testing.T) {
	service, mockDoc, _ := setupServiceTest(t)
	ctx := context.Background()

	// Setup mock document
	mockDoc.doc = &document.DocumentWithTags{
		Document: &document.Document{
			Path:         "projects/@test/doc-123.json",
			ProjectAlias: "@test",
			Title:        "Test Document",
		},
		File: &document.DocumentFile{
			Meta: document.DocumentMeta{
				Title:   "Test Document",
				Project: "@test",
			},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   "block1",
					Type: "paragraph",
					Content: mustMarshalContent([]document.BlockNoteContent{
						{Type: "text", Text: "Test"},
					}),
				},
			},
		},
		Tags: []string{},
	}

	// Use a nested directory that doesn't exist
	outputPath := filepath.Join(t.TempDir(), "nested", "dir", "output.pdf")

	req := ExportRequest{
		DocumentPath: "projects/@test/doc-123.json",
		OutputPath:   outputPath,
	}

	err := service.ExportToPDF(ctx, req)
	require.NoError(t, err, "ExportToPDF() should create output directory")

	// Verify output file exists
	_, err = os.Stat(outputPath)
	assert.NoError(t, err, "Output PDF file should exist in nested directory")
}
