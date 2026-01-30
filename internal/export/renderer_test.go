package export

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"yanta/internal/document"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRendererTest(t *testing.T) (*Renderer, *PDF, *mockVaultProvider) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	tmpDir := t.TempDir()
	vault := &mockVaultProvider{
		rootPath:   tmpDir,
		assetsPath: filepath.Join(tmpDir, "assets", "@test"),
	}

	renderer := NewRenderer(pdf, vault, "@test")
	return renderer, pdf, vault
}

func TestNewRenderer(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	vault := &mockVaultProvider{rootPath: t.TempDir()}
	renderer := NewRenderer(pdf, vault, "@test")

	require.NotNil(t, renderer)
	assert.Equal(t, pdf, renderer.pdf)
	assert.Equal(t, vault, renderer.vault)
	assert.Equal(t, "@test", renderer.projectAlias)
	assert.Equal(t, 0, renderer.listItemIndex)
}

func TestRenderer_RenderBlock_Heading(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "h1",
		Type: "heading",
		Props: map[string]any{
			"level": float64(2),
		},
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Test Heading"},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Paragraph(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "p1",
		Type: "paragraph",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Test paragraph content."},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_CodeBlock(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "code1",
		Type: "codeBlock",
		Props: map[string]any{
			"language": "go",
		},
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "func main() {}"},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_BulletListItem(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "bullet1",
		Type: "bulletListItem",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Bullet point"},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_NumberedListItem(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block1 := document.BlockNoteBlock{
		ID:   "num1",
		Type: "numberedListItem",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "First item"},
		}),
	}

	err := renderer.RenderBlock(block1)
	require.NoError(t, err)
	assert.Equal(t, 1, renderer.listItemIndex)

	block2 := document.BlockNoteBlock{
		ID:   "num2",
		Type: "numberedListItem",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Second item"},
		}),
	}

	err = renderer.RenderBlock(block2)
	require.NoError(t, err)
	assert.Equal(t, 2, renderer.listItemIndex)
}

func TestRenderer_RenderBlock_CheckListItem(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	tests := []struct {
		name    string
		checked bool
	}{
		{"unchecked", false},
		{"checked", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			block := document.BlockNoteBlock{
				ID:   "check1",
				Type: "checkListItem",
				Props: map[string]any{
					"checked": tt.checked,
				},
				Content: mustMarshalContent([]document.BlockNoteContent{
					{Type: "text", Text: "Checklist item"},
				}),
			}

			err := renderer.RenderBlock(block)
			require.NoError(t, err)
		})
	}
}

func TestRenderer_RenderBlock_CheckListItem_EmptyProps(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:      "check1",
		Type:    "checkListItem",
		Props:   nil,
		Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: "Item"}}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Quote(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "quote1",
		Type: "quote",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "This is a quote"},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Image(t *testing.T) {
	renderer, _, vault := setupRendererTest(t)

	// Create assets directory and test image
	assetsDir := vault.AssetsPath("@test")
	err := os.MkdirAll(assetsDir, 0755)
	require.NoError(t, err)

	imagePath := filepath.Join(assetsDir, "test.png")
	pngData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE,
		0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
		0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
		0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4,
		0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
		0xAE, 0x42, 0x60, 0x82,
	}
	err = os.WriteFile(imagePath, pngData, 0644)
	require.NoError(t, err)

	block := document.BlockNoteBlock{
		ID:   "img1",
		Type: "image",
		Props: map[string]any{
			"url":     "/assets/@test/test.png",
			"caption": "Test Image",
		},
	}

	err = renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Image_EmptyProps(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:    "img1",
		Type:  "image",
		Props: nil,
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Image_NoURL(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "img1",
		Type: "image",
		Props: map[string]any{
			"caption": "Image without URL",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Image_InvalidURL(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "img1",
		Type: "image",
		Props: map[string]any{
			"url": "invalid-url",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err) // Should not error, just skip the image
}

func TestRenderer_RenderBlock_Image_NotFound(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "img1",
		Type: "image",
		Props: map[string]any{
			"url": "/assets/@test/nonexistent.png",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err) // Should not error, just skip the image
}

func TestRenderer_RenderBlock_File(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "file1",
		Type: "file",
		Props: map[string]any{
			"url":  "/uploads/document.pdf",
			"name": "Document.pdf",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_File_NoName(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "file1",
		Type: "file",
		Props: map[string]any{
			"url": "/uploads/document.pdf",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_File_EmptyProps(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:    "file1",
		Type:  "file",
		Props: nil,
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_File_NoURL(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "file1",
		Type: "file",
		Props: map[string]any{
			"name": "Document.pdf",
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Table(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	tableData := map[string]any{
		"type": "table",
		"rows": []map[string]any{
			{
				"cells": []map[string]any{
					{
						"type": "tableCell",
						"content": []map[string]any{
							{"type": "text", "text": "Header 1"},
						},
					},
					{
						"type": "tableCell",
						"content": []map[string]any{
							{"type": "text", "text": "Header 2"},
						},
					},
				},
			},
			{
				"cells": []map[string]any{
					{
						"type": "tableCell",
						"content": []map[string]any{
							{"type": "text", "text": "Cell 1"},
						},
					},
					{
						"type": "tableCell",
						"content": []map[string]any{
							{"type": "text", "text": "Cell 2"},
						},
					},
				},
			},
		},
	}

	content, err := json.Marshal(tableData)
	require.NoError(t, err)

	block := document.BlockNoteBlock{
		ID:      "table1",
		Type:    "table",
		Content: content,
	}

	err = renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Table_Empty(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:      "table1",
		Type:    "table",
		Content: json.RawMessage(`{"type":"table","rows":[]}`),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_RenderBlock_Table_InvalidJSON(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:      "table1",
		Type:    "table",
		Content: json.RawMessage(`invalid json`),
	}

	err := renderer.RenderBlock(block)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmarshaling table content")
}

func TestRenderer_RenderBlock_UnknownType(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "unknown1",
		Type: "unknownBlockType",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Unknown block content"},
		}),
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err) // Should handle unknown types gracefully
}

func TestRenderer_RenderBlock_WithChildren(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "parent",
		Type: "paragraph",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Parent paragraph"},
		}),
		Children: []document.BlockNoteBlock{
			{
				ID:   "child1",
				Type: "paragraph",
				Content: mustMarshalContent([]document.BlockNoteContent{
					{Type: "text", Text: "Child paragraph"},
				}),
			},
		},
	}

	err := renderer.RenderBlock(block)
	require.NoError(t, err)
}

func TestRenderer_ExtractTextFromContent(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	tests := []struct {
		name     string
		content  []document.BlockNoteContent
		expected string
	}{
		{
			name: "plain text",
			content: []document.BlockNoteContent{
				{Type: "text", Text: "Hello World"},
			},
			expected: "Hello World",
		},
		{
			name: "bold text",
			content: []document.BlockNoteContent{
				{Type: "text", Text: "Bold Text", Styles: map[string]any{"bold": true}},
			},
			expected: "**Bold Text**",
		},
		{
			name: "italic text",
			content: []document.BlockNoteContent{
				{Type: "text", Text: "Italic Text", Styles: map[string]any{"italic": true}},
			},
			expected: "_Italic Text_",
		},
		{
			name: "code text",
			content: []document.BlockNoteContent{
				{Type: "text", Text: "code", Styles: map[string]any{"code": true}},
			},
			expected: "`code`",
		},
		{
			name: "link with content",
			content: []document.BlockNoteContent{
				{
					Type: "link",
					Href: "https://example.com",
					Content: []document.BlockNoteContent{
						{Type: "text", Text: "Example Link"},
					},
				},
			},
			expected: "Example Link",
		},
		{
			name: "link without content",
			content: []document.BlockNoteContent{
				{Type: "link", Href: "https://example.com"},
			},
			expected: "https://example.com",
		},
		{
			name: "multiple items",
			content: []document.BlockNoteContent{
				{Type: "text", Text: "Hello "},
				{Type: "text", Text: "World", Styles: map[string]any{"bold": true}},
			},
			expected: "Hello **World**",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := renderer.extractTextFromContentSlice(tt.content)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRenderer_ExtractTextFromContent_EmptyText(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	content := []document.BlockNoteContent{
		{Type: "text", Text: ""},
	}

	result := renderer.extractTextFromContentSlice(content)
	assert.Equal(t, "", result)
}

func TestRenderer_ExtractTextFromBlock(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	block := document.BlockNoteBlock{
		ID:   "test",
		Type: "paragraph",
		Content: mustMarshalContent([]document.BlockNoteContent{
			{Type: "text", Text: "Test text"},
		}),
	}

	result := renderer.extractTextFromBlock(block)
	assert.Equal(t, "Test text", result)
}

func TestRenderer_ResolveImagePath(t *testing.T) {
	renderer, _, vault := setupRendererTest(t)

	tests := []struct {
		name        string
		url         string
		expectError bool
		expectPath  string
	}{
		{
			name:        "valid asset URL",
			url:         "/assets/@test/image.png",
			expectError: false,
			expectPath:  filepath.Join(vault.AssetsPath("@test"), "image.png"),
		},
		{
			name:        "invalid format - no assets prefix",
			url:         "/images/test.png",
			expectError: true,
		},
		{
			name:        "invalid format - too few parts",
			url:         "/assets/test.png",
			expectError: true,
		},
		{
			name:        "valid with leading/trailing slashes",
			url:         "///assets/@test/image.jpg///",
			expectError: false,
			expectPath:  filepath.Join(vault.AssetsPath("@test"), "image.jpg"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path, err := renderer.resolveImagePath(tt.url)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectPath, path)
			}
		})
	}
}

func TestRenderer_RenderBlock_EmptyContent(t *testing.T) {
	renderer, _, _ := setupRendererTest(t)

	tests := []struct {
		name      string
		blockType string
	}{
		{"heading", "heading"},
		{"paragraph", "paragraph"},
		{"codeBlock", "codeBlock"},
		{"bulletListItem", "bulletListItem"},
		{"numberedListItem", "numberedListItem"},
		{"checkListItem", "checkListItem"},
		{"quote", "quote"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			block := document.BlockNoteBlock{
				ID:      "test",
				Type:    tt.blockType,
				Content: mustMarshalContent([]document.BlockNoteContent{}),
			}

			err := renderer.RenderBlock(block)
			require.NoError(t, err)
		})
	}
}
