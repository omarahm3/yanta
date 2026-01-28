package document

import (
	"os"
	"path/filepath"
	"testing"

	"yanta/internal/asset"
	"yanta/internal/vault"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupExportTest(t *testing.T) (*Exporter, *vault.Vault, func()) {
	tmpDir := t.TempDir()
	v, err := vault.New(vault.Config{RootPath: tmpDir})
	require.NoError(t, err, "failed to create vault")

	exporter := NewExporter(v)

	cleanup := func() {
		// Nothing to cleanup for exporter tests
	}

	return exporter, v, cleanup
}

func createTestDocument(t *testing.T, v *vault.Vault, projectAlias, title string, blocks []BlockNoteBlock) string {
	fm := NewFileManager(v)

	// Ensure project directory exists
	err := v.EnsureProjectDir(projectAlias)
	require.NoError(t, err, "failed to create project directory")

	// Create document file
	docFile := NewDocumentFile(projectAlias, title, []string{"test"})
	docFile.Blocks = blocks

	// Generate a test document path
	relativePath := "projects/" + projectAlias + "/doc-test-" + title + ".json"

	// Write the file
	err = fm.WriteFile(relativePath, docFile)
	require.NoError(t, err, "failed to write test document")

	return relativePath
}

func TestExportDocument_BasicExport(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	blocks := []BlockNoteBlock{
		{
			ID:   "block1",
			Type: "paragraph",
			Content: mustMarshalContent([]BlockNoteContent{
				{Type: "text", Text: "Hello World"},
			}),
		},
	}

	docPath := createTestDocument(t, v, "@test", "Test Document", blocks)

	outputDir := t.TempDir()
	outputPath := filepath.Join(outputDir, "test.md")

	req := ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	}

	err := exporter.ExportDocument(req)
	require.NoError(t, err, "ExportDocument() failed")

	// Verify file was created
	_, err = os.Stat(outputPath)
	require.NoError(t, err, "Output file should exist")

	// Verify content
	content, err := os.ReadFile(outputPath)
	require.NoError(t, err, "Failed to read output file")

	markdown := string(content)
	assert.Contains(t, markdown, "title: Test Document")
	assert.Contains(t, markdown, "project: @test")
	assert.Contains(t, markdown, "Hello World")
}

func TestExportDocument_EmptyDocumentPath(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	outputDir := t.TempDir()
	outputPath := filepath.Join(outputDir, "test.md")

	req := ExportDocumentRequest{
		DocumentPath: "",
		OutputPath:   outputPath,
	}

	err := exporter.ExportDocument(req)
	assert.Error(t, err, "Expected error for empty document path")
	assert.Contains(t, err.Error(), "document path is required")
}

func TestExportDocument_EmptyOutputPath(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	blocks := []BlockNoteBlock{
		{
			ID:   "block1",
			Type: "paragraph",
			Content: mustMarshalContent([]BlockNoteContent{
				{Type: "text", Text: "Test"},
			}),
		},
	}

	docPath := createTestDocument(t, v, "@test", "Test", blocks)

	req := ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   "",
	}

	err := exporter.ExportDocument(req)
	assert.Error(t, err, "Expected error for empty output path")
	assert.Contains(t, err.Error(), "output path is required")
}

func TestExportDocument_InvalidDocumentPath(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	outputDir := t.TempDir()
	outputPath := filepath.Join(outputDir, "test.md")

	req := ExportDocumentRequest{
		DocumentPath: "projects/@test/nonexistent.json",
		OutputPath:   outputPath,
	}

	err := exporter.ExportDocument(req)
	assert.Error(t, err, "Expected error for nonexistent document")
	assert.Contains(t, err.Error(), "reading document")
}

func TestExportDocument_WithAssets(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	// Create a test asset
	assetData := []byte("fake image data")
	assetInfo, err := asset.WriteAsset(v, "@test", assetData, ".png")
	require.NoError(t, err, "Failed to create test asset")

	// Create document with image block
	blocks := []BlockNoteBlock{
		{
			ID:   "block1",
			Type: "paragraph",
			Content: mustMarshalContent([]BlockNoteContent{
				{Type: "text", Text: "Document with image"},
			}),
		},
		{
			ID:   "block2",
			Type: "image",
			Props: map[string]any{
				"url":     "/api/assets/@test/" + assetInfo.Hash + assetInfo.Ext,
				"caption": "Test Image",
			},
		},
	}

	docPath := createTestDocument(t, v, "@test", "Document with Assets", blocks)

	outputDir := t.TempDir()
	outputPath := filepath.Join(outputDir, "test.md")

	req := ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	}

	err = exporter.ExportDocument(req)
	require.NoError(t, err, "ExportDocument() failed")

	// Verify markdown file was created
	markdown, err := os.ReadFile(outputPath)
	require.NoError(t, err, "Failed to read output file")

	// Verify asset link was rewritten
	assert.Contains(t, string(markdown), "./assets/"+assetInfo.Hash+assetInfo.Ext)
	assert.NotContains(t, string(markdown), "/api/assets/")

	// Verify asset was copied
	assetPath := filepath.Join(outputDir, "assets", assetInfo.Hash+assetInfo.Ext)
	_, err = os.Stat(assetPath)
	require.NoError(t, err, "Asset file should exist")

	// Verify asset content
	copiedData, err := os.ReadFile(assetPath)
	require.NoError(t, err, "Failed to read copied asset")
	assert.Equal(t, assetData, copiedData, "Asset content should match")
}

func TestExportDocument_CreatesOutputDirectory(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	blocks := []BlockNoteBlock{
		{
			ID:   "block1",
			Type: "paragraph",
			Content: mustMarshalContent([]BlockNoteContent{
				{Type: "text", Text: "Test"},
			}),
		},
	}

	docPath := createTestDocument(t, v, "@test", "Test", blocks)

	outputDir := t.TempDir()
	outputPath := filepath.Join(outputDir, "subdir", "nested", "test.md")

	req := ExportDocumentRequest{
		DocumentPath: docPath,
		OutputPath:   outputPath,
	}

	err := exporter.ExportDocument(req)
	require.NoError(t, err, "ExportDocument() failed")

	// Verify nested directory was created
	_, err = os.Stat(filepath.Dir(outputPath))
	require.NoError(t, err, "Nested directory should exist")

	// Verify file exists
	_, err = os.Stat(outputPath)
	require.NoError(t, err, "Output file should exist")
}

func TestExportProject_BasicExport(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	// Create multiple test documents
	for i := 1; i <= 3; i++ {
		blocks := []BlockNoteBlock{
			{
				ID:   "block1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Document " + string(rune('0'+i))},
				}),
			},
		}
		createTestDocument(t, v, "@test", "Document "+string(rune('0'+i)), blocks)
	}

	outputDir := t.TempDir()

	req := ExportProjectRequest{
		ProjectAlias: "@test",
		OutputDir:    outputDir,
	}

	err := exporter.ExportProject(req)
	require.NoError(t, err, "ExportProject() failed")

	// Verify all documents were exported
	files, err := os.ReadDir(outputDir)
	require.NoError(t, err, "Failed to read output directory")

	mdFiles := 0
	for _, file := range files {
		if filepath.Ext(file.Name()) == ".md" {
			mdFiles++
		}
	}
	assert.Equal(t, 3, mdFiles, "Expected 3 markdown files")
}

func TestExportProject_EmptyProjectAlias(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	outputDir := t.TempDir()

	req := ExportProjectRequest{
		ProjectAlias: "",
		OutputDir:    outputDir,
	}

	err := exporter.ExportProject(req)
	assert.Error(t, err, "Expected error for empty project alias")
	assert.Contains(t, err.Error(), "project alias is required")
}

func TestExportProject_EmptyOutputDir(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	req := ExportProjectRequest{
		ProjectAlias: "@test",
		OutputDir:    "",
	}

	err := exporter.ExportProject(req)
	assert.Error(t, err, "Expected error for empty output directory")
	assert.Contains(t, err.Error(), "output directory is required")
}

func TestExportProject_NoDocuments(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	outputDir := t.TempDir()

	req := ExportProjectRequest{
		ProjectAlias: "@test",
		OutputDir:    outputDir,
	}

	err := exporter.ExportProject(req)
	require.NoError(t, err, "ExportProject() should succeed with no documents")

	// Verify output directory was created but is empty
	files, err := os.ReadDir(outputDir)
	require.NoError(t, err, "Failed to read output directory")
	assert.Len(t, files, 0, "Output directory should be empty")
}

func TestExportProject_WithAssets(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	// Create test asset
	assetData := []byte("test asset content")
	assetInfo, err := asset.WriteAsset(v, "@test", assetData, ".png")
	require.NoError(t, err, "Failed to create test asset")

	// Create document with asset reference
	blocks := []BlockNoteBlock{
		{
			ID:   "block1",
			Type: "image",
			Props: map[string]any{
				"url":     "/api/assets/@test/" + assetInfo.Hash + assetInfo.Ext,
				"caption": "Test",
			},
		},
	}

	createTestDocument(t, v, "@test", "Doc with Asset", blocks)

	outputDir := t.TempDir()

	req := ExportProjectRequest{
		ProjectAlias: "@test",
		OutputDir:    outputDir,
	}

	err = exporter.ExportProject(req)
	require.NoError(t, err, "ExportProject() failed")

	// Verify assets directory was created
	assetsDir := filepath.Join(outputDir, "assets")
	_, err = os.Stat(assetsDir)
	require.NoError(t, err, "Assets directory should exist")

	// Verify asset was copied
	assetPath := filepath.Join(assetsDir, assetInfo.Hash+assetInfo.Ext)
	_, err = os.Stat(assetPath)
	require.NoError(t, err, "Asset file should exist")
}

func TestParseAssetURL_Valid(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	tests := []struct {
		name          string
		url           string
		expectedAlias string
		expectedHash  string
		expectedExt   string
	}{
		{
			name:          "With extension",
			url:           "/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png",
			expectedAlias: "@test",
			expectedHash:  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectedExt:   ".png",
		},
		{
			name:          "Without extension",
			url:           "/api/assets/@myproject/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectedAlias: "@myproject",
			expectedHash:  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectedExt:   "",
		},
		{
			name:          "Different extension",
			url:           "/api/assets/@test/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.jpg",
			expectedAlias: "@test",
			expectedHash:  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
			expectedExt:   ".jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ref, err := exporter.parseAssetURL(tt.url)
			require.NoError(t, err, "parseAssetURL() failed")
			assert.Equal(t, tt.expectedAlias, ref.ProjectAlias)
			assert.Equal(t, tt.expectedHash, ref.Hash)
			assert.Equal(t, tt.expectedExt, ref.Ext)
			assert.Equal(t, tt.url, ref.OriginalURL)
		})
	}
}

func TestParseAssetURL_Invalid(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	tests := []struct {
		name string
		url  string
	}{
		{
			name: "Missing /api/assets prefix",
			url:  "/@test/hash.png",
		},
		{
			name: "Invalid hash length",
			url:  "/api/assets/@test/short.png",
		},
		{
			name: "Invalid hash characters",
			url:  "/api/assets/@test/ghijklmnopqrstuvwxyzghijklmnopqrstuvwxyzghijklmnopqrstuvwxyz12.png",
		},
		{
			name: "Missing project alias",
			url:  "/api/assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png",
		},
		{
			name: "Empty URL",
			url:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := exporter.parseAssetURL(tt.url)
			assert.Error(t, err, "Expected error for invalid URL")
		})
	}
}

func TestExtractAssetReferences_Images(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

![Image 1](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)

Some text here.

![Image 2](/api/assets/@test/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.jpg)
`

	refs := exporter.extractAssetReferences(markdown)
	assert.Len(t, refs, 2, "Expected 2 asset references")
	assert.Equal(t, "@test", refs[0].ProjectAlias)
	assert.Equal(t, ".png", refs[0].Ext)
	assert.Equal(t, "@test", refs[1].ProjectAlias)
	assert.Equal(t, ".jpg", refs[1].Ext)
}

func TestExtractAssetReferences_Links(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

[Download File](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.pdf)
`

	refs := exporter.extractAssetReferences(markdown)
	assert.Len(t, refs, 1, "Expected 1 asset reference")
	assert.Equal(t, "@test", refs[0].ProjectAlias)
	assert.Equal(t, ".pdf", refs[0].Ext)
}

func TestExtractAssetReferences_Mixed(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

![Image](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)

[File](/api/assets/@test/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.pdf)

Regular [link](https://example.com) should be ignored.
`

	refs := exporter.extractAssetReferences(markdown)
	assert.Len(t, refs, 2, "Expected 2 asset references")
}

func TestExtractAssetReferences_Duplicates(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

![Image 1](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)

![Image 2](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)
`

	refs := exporter.extractAssetReferences(markdown)
	assert.Len(t, refs, 2, "Should include duplicates")
	assert.Equal(t, refs[0].Hash, refs[1].Hash, "Both references should have same hash")
}

func TestExtractAssetReferences_NoAssets(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

Regular content with no assets.

[External link](https://example.com)
`

	refs := exporter.extractAssetReferences(markdown)
	assert.Len(t, refs, 0, "Expected no asset references")
}

func TestRewriteAssetLinks(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

![Image](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)
`

	refs := []*assetReference{
		{
			ProjectAlias: "@test",
			Hash:         "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			Ext:          ".png",
			OriginalURL:  "/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png",
		},
	}

	result := exporter.rewriteAssetLinks(markdown, refs)

	assert.NotContains(t, result, "/api/assets/")
	assert.Contains(t, result, "./assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png")
}

func TestRewriteAssetLinks_MultipleRefs(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	markdown := `# Document

![Image 1](/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png)
[File](/api/assets/@test/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.pdf)
`

	refs := []*assetReference{
		{
			Hash:        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			Ext:         ".png",
			OriginalURL: "/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png",
		},
		{
			Hash:        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
			Ext:         ".pdf",
			OriginalURL: "/api/assets/@test/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.pdf",
		},
	}

	result := exporter.rewriteAssetLinks(markdown, refs)

	assert.NotContains(t, result, "/api/assets/")
	assert.Contains(t, result, "./assets/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png")
	assert.Contains(t, result, "./assets/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.pdf")
}

func TestCopyAsset_Success(t *testing.T) {
	exporter, v, cleanup := setupExportTest(t)
	defer cleanup()

	// Create test asset in vault
	assetData := []byte("test asset content")
	assetInfo, err := asset.WriteAsset(v, "@test", assetData, ".png")
	require.NoError(t, err, "Failed to create test asset")

	// Copy asset to export directory
	outputDir := t.TempDir()
	assetsDir := filepath.Join(outputDir, "assets")

	ref := &assetReference{
		ProjectAlias: "@test",
		Hash:         assetInfo.Hash,
		Ext:          assetInfo.Ext,
		OriginalURL:  "/api/assets/@test/" + assetInfo.Hash + assetInfo.Ext,
	}

	err = exporter.copyAsset(ref, assetsDir)
	require.NoError(t, err, "copyAsset() failed")

	// Verify asset was copied
	assetPath := filepath.Join(assetsDir, assetInfo.Hash+assetInfo.Ext)
	copiedData, err := os.ReadFile(assetPath)
	require.NoError(t, err, "Failed to read copied asset")
	assert.Equal(t, assetData, copiedData, "Asset content should match")
}

func TestCopyAsset_AssetNotFound(t *testing.T) {
	exporter, _, cleanup := setupExportTest(t)
	defer cleanup()

	outputDir := t.TempDir()
	assetsDir := filepath.Join(outputDir, "assets")

	ref := &assetReference{
		ProjectAlias: "@test",
		Hash:         "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		Ext:          ".png",
		OriginalURL:  "/api/assets/@test/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.png",
	}

	err := exporter.copyAsset(ref, assetsDir)
	assert.Error(t, err, "Expected error for nonexistent asset")
	assert.Contains(t, err.Error(), "reading asset from vault")
}
