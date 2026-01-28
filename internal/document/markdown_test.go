package document

import (
	"testing"
	"time"
)

func TestMarkdownConverter(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test Document",
			Tags:    []string{"test"},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Main Heading"},
				}),
			},
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is a paragraph."},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if markdown == "" {
		t.Error("Expected non-empty markdown output")
	}

	if !contains(markdown, "# Main Heading") {
		t.Error("Expected markdown to contain heading")
	}

	if !contains(markdown, "This is a paragraph.") {
		t.Error("Expected markdown to contain paragraph text")
	}
}

func TestMarkdownConverter_Heading(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Heading 1"},
				}),
			},
			{
				ID:   "h2",
				Type: "heading",
				Props: map[string]any{
					"level": float64(2),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Heading 2"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "# Heading 1") {
		t.Error("Expected H1 markdown format")
	}

	if !contains(markdown, "## Heading 2") {
		t.Error("Expected H2 markdown format")
	}
}

func TestMarkdownConverter_Paragraph(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is "},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
					{Type: "text", Text: " and "},
					{Type: "text", Text: "italic", Styles: map[string]any{"italic": true}},
					{Type: "text", Text: " text."},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "**bold**") {
		t.Error("Expected bold markdown formatting")
	}

	if !contains(markdown, "*italic*") {
		t.Error("Expected italic markdown formatting")
	}
}

func TestMarkdownConverter_CodeBlock(t *testing.T) {
	converter := NewMarkdownConverter()

	codeText := `func main() {
	fmt.Println("Hello")
}`

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "code1",
				Type: "codeBlock",
				Props: map[string]any{
					"language": "go",
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: codeText},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "```go") {
		t.Error("Expected code block with language")
	}

	if !contains(markdown, codeText) {
		t.Error("Expected code content in output")
	}

	if !contains(markdown, "```") {
		t.Error("Expected closing code fence")
	}
}

func TestMarkdownConverter_BulletList(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "li1",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "First item"},
				}),
			},
			{
				ID:   "li2",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Second item"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "- First item") {
		t.Error("Expected bullet list item format")
	}

	if !contains(markdown, "- Second item") {
		t.Error("Expected second bullet list item")
	}
}

func TestMarkdownConverter_NumberedList(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "li1",
				Type: "numberedListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "First numbered item"},
				}),
			},
			{
				ID:   "li2",
				Type: "numberedListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Second numbered item"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "1. First numbered item") {
		t.Error("Expected numbered list item format")
	}

	if !contains(markdown, "1. Second numbered item") {
		t.Error("Expected second numbered list item")
	}
}

func TestMarkdownConverter_CheckList(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "check1",
				Type: "checkListItem",
				Props: map[string]any{
					"checked": false,
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Unchecked task"},
				}),
			},
			{
				ID:   "check2",
				Type: "checkListItem",
				Props: map[string]any{
					"checked": true,
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Checked task"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "- [ ] Unchecked task") {
		t.Error("Expected unchecked checkbox format")
	}

	if !contains(markdown, "- [x] Checked task") {
		t.Error("Expected checked checkbox format")
	}
}

func TestMarkdownConverter_Link(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Check out "},
					{
						Type: "link",
						Content: []BlockNoteContent{
							{Type: "text", Text: "GitHub"},
						},
						Href: "https://github.com",
					},
					{Type: "text", Text: " for more."},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "[GitHub](https://github.com)") {
		t.Error("Expected markdown link format")
	}
}

func TestMarkdownConverter_Image(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "img1",
				Type: "image",
				Props: map[string]any{
					"url":     "projects/@test/assets/diagram.png",
					"caption": "Architecture diagram",
				},
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "![Architecture diagram](projects/@test/assets/diagram.png)") {
		t.Error("Expected markdown image format")
	}
}

func TestMarkdownConverter_Quote(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "quote1",
				Type: "quote",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is a quote."},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "> This is a quote.") {
		t.Error("Expected markdown quote format")
	}
}

func TestMarkdownConverter_File(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "file1",
				Type: "file",
				Props: map[string]any{
					"url":  "projects/@test/assets/document.pdf",
					"name": "Important Document",
				},
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "[Important Document](projects/@test/assets/document.pdf)") {
		t.Error("Expected markdown file link format")
	}
}

func TestYAMLFrontmatter(t *testing.T) {
	converter := NewMarkdownConverter()

	created := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)
	updated := time.Date(2024, 1, 16, 14, 45, 0, 0, time.UTC)

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test Document",
			Tags:    []string{"test", "documentation"},
			Aliases: []string{"test-doc", "doc1"},
			Created: created,
			Updated: updated,
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Content"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	// Check frontmatter delimiters
	if !contains(markdown, "---") {
		t.Error("Expected YAML frontmatter delimiters")
	}

	// Check title
	if !contains(markdown, "title: Test Document") {
		t.Error("Expected title in frontmatter")
	}

	// Check project
	if !contains(markdown, "project: @test") {
		t.Error("Expected project in frontmatter")
	}

	// Check tags
	if !contains(markdown, "tags:") {
		t.Error("Expected tags in frontmatter")
	}
	if !contains(markdown, "  - test") {
		t.Error("Expected tag 'test' in frontmatter")
	}
	if !contains(markdown, "  - documentation") {
		t.Error("Expected tag 'documentation' in frontmatter")
	}

	// Check aliases
	if !contains(markdown, "aliases:") {
		t.Error("Expected aliases in frontmatter")
	}
	if !contains(markdown, "  - test-doc") {
		t.Error("Expected alias 'test-doc' in frontmatter")
	}
	if !contains(markdown, "  - doc1") {
		t.Error("Expected alias 'doc1' in frontmatter")
	}

	// Check timestamps
	if !contains(markdown, "created: 2024-01-15T10:30:00Z") {
		t.Error("Expected created timestamp in frontmatter")
	}
	if !contains(markdown, "updated: 2024-01-16T14:45:00Z") {
		t.Error("Expected updated timestamp in frontmatter")
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s == substr || len(s) >= len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsSubstring(s, substr)))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestMarkdownConverter_Table(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "table1",
				Type: "table",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "tableContent"},
				}),
			},
		},
	}

	// Manually create table structure
	tableJSON := `{
		"type": "tableContent",
		"columnWidths": [null, null],
		"rows": [
			{
				"cells": [
					{
						"type": "tableCell",
						"content": [{"type": "text", "text": "Header 1", "styles": {}}],
						"props": {}
					},
					{
						"type": "tableCell",
						"content": [{"type": "text", "text": "Header 2", "styles": {}}],
						"props": {}
					}
				]
			},
			{
				"cells": [
					{
						"type": "tableCell",
						"content": [{"type": "text", "text": "Cell 1", "styles": {}}],
						"props": {}
					},
					{
						"type": "tableCell",
						"content": [{"type": "text", "text": "Cell 2", "styles": {}}],
						"props": {}
					}
				]
			}
		]
	}`
	doc.Blocks[0].Content = []byte(tableJSON)

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "| Header 1 | Header 2 |") {
		t.Error("Expected table header row")
	}

	if !contains(markdown, "| --- | --- |") {
		t.Error("Expected table separator row")
	}

	if !contains(markdown, "| Cell 1 | Cell 2 |") {
		t.Error("Expected table data row")
	}
}

func TestMarkdownConverter_NestedLists(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "li1",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Parent item"},
				}),
				Children: []BlockNoteBlock{
					{
						ID:   "li2",
						Type: "bulletListItem",
						Content: mustMarshalContent([]BlockNoteContent{
							{Type: "text", Text: "Child item"},
						}),
						Children: []BlockNoteBlock{
							{
								ID:   "li3",
								Type: "bulletListItem",
								Content: mustMarshalContent([]BlockNoteContent{
									{Type: "text", Text: "Grandchild item"},
								}),
							},
						},
					},
				},
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "- Parent item") {
		t.Error("Expected parent list item")
	}

	if !contains(markdown, "  - Child item") {
		t.Error("Expected indented child list item")
	}

	if !contains(markdown, "    - Grandchild item") {
		t.Error("Expected double-indented grandchild list item")
	}
}

func TestMarkdownConverter_TextStyles(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Normal "},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
					{Type: "text", Text: " "},
					{Type: "text", Text: "italic", Styles: map[string]any{"italic": true}},
					{Type: "text", Text: " "},
					{Type: "text", Text: "code", Styles: map[string]any{"code": true}},
					{Type: "text", Text: " "},
					{Type: "text", Text: "strike", Styles: map[string]any{"strike": true}},
					{Type: "text", Text: " "},
					{Type: "text", Text: "bold-italic", Styles: map[string]any{"bold": true, "italic": true}},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "**bold**") {
		t.Error("Expected bold markdown")
	}

	if !contains(markdown, "*italic*") {
		t.Error("Expected italic markdown")
	}

	if !contains(markdown, "`code`") {
		t.Error("Expected code markdown")
	}

	if !contains(markdown, "~~strike~~") {
		t.Error("Expected strikethrough markdown")
	}

	if !contains(markdown, "***bold-italic***") {
		t.Error("Expected combined bold+italic markdown")
	}
}

func TestMarkdownConverter_EmptyDocument(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Empty Doc",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if markdown == "" {
		t.Error("Expected non-empty markdown (should have frontmatter)")
	}

	if !contains(markdown, "title: Empty Doc") {
		t.Error("Expected frontmatter with title")
	}

	if !contains(markdown, "---") {
		t.Error("Expected frontmatter delimiters")
	}
}

func TestMarkdownConverter_ComplexDocument(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Complex Document",
			Tags:    []string{"test"},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Main Title"},
				}),
			},
			{
				ID:   "p1",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "This is a paragraph with "},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
					{Type: "text", Text: " text and a "},
					{
						Type: "link",
						Content: []BlockNoteContent{
							{Type: "text", Text: "link"},
						},
						Href: "https://example.com",
					},
					{Type: "text", Text: "."},
				}),
			},
			{
				ID:   "code1",
				Type: "codeBlock",
				Props: map[string]any{
					"language": "go",
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "func main() {}"},
				}),
			},
			{
				ID:   "img1",
				Type: "image",
				Props: map[string]any{
					"url":     "assets/img.png",
					"caption": "Diagram",
				},
			},
			{
				ID:   "li1",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "List item"},
				}),
			},
			{
				ID:   "quote1",
				Type: "quote",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "A quote"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	// Verify all components are present
	if !contains(markdown, "# Main Title") {
		t.Error("Expected heading")
	}

	if !contains(markdown, "**bold**") {
		t.Error("Expected bold text")
	}

	if !contains(markdown, "[link](https://example.com)") {
		t.Error("Expected link")
	}

	if !contains(markdown, "```go") {
		t.Error("Expected code block")
	}

	if !contains(markdown, "![Diagram](assets/img.png)") {
		t.Error("Expected image")
	}

	if !contains(markdown, "- List item") {
		t.Error("Expected list item")
	}

	if !contains(markdown, "> A quote") {
		t.Error("Expected quote")
	}
}

func TestMarkdownConverter_HeadingLevels(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "H1"},
				}),
			},
			{
				ID:   "h2",
				Type: "heading",
				Props: map[string]any{
					"level": float64(2),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "H2"},
				}),
			},
			{
				ID:   "h3",
				Type: "heading",
				Props: map[string]any{
					"level": float64(3),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "H3"},
				}),
			},
			{
				ID:   "h6",
				Type: "heading",
				Props: map[string]any{
					"level": float64(6),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "H6"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "# H1") {
		t.Error("Expected H1 markdown")
	}

	if !contains(markdown, "## H2") {
		t.Error("Expected H2 markdown")
	}

	if !contains(markdown, "### H3") {
		t.Error("Expected H3 markdown")
	}

	if !contains(markdown, "###### H6") {
		t.Error("Expected H6 markdown")
	}
}

func TestMarkdownConverter_EmptyBlocks(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:      "p1",
				Type:    "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{}),
			},
			{
				ID:   "p2",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Non-empty"},
				}),
			},
			{
				ID:      "h1",
				Type:    "heading",
				Content: mustMarshalContent([]BlockNoteContent{}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "Non-empty") {
		t.Error("Expected non-empty paragraph to be included")
	}

	// Empty blocks should not cause errors or add extra content
	if markdown == "" {
		t.Error("Expected output with frontmatter")
	}
}

func TestMarkdownConverter_MissingProps(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				// No Props - should default to level 1
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Default Heading"},
				}),
			},
			{
				ID:   "code1",
				Type: "codeBlock",
				// No Props - should have no language
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "code()"},
				}),
			},
			{
				ID:   "img1",
				Type: "image",
				// No Props - should be skipped
				Props: nil,
			},
			{
				ID:   "check1",
				Type: "checkListItem",
				// No Props - should default to unchecked
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Task"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "# Default Heading") {
		t.Error("Expected default H1 for heading without props")
	}

	if !contains(markdown, "```\ncode()") {
		t.Error("Expected code block without language")
	}

	if !contains(markdown, "- [ ] Task") {
		t.Error("Expected default unchecked checkbox")
	}
}

func TestMarkdownConverter_FrontmatterEdgeCases(t *testing.T) {
	converter := NewMarkdownConverter()

	created := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	updated := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name string
		meta DocumentMeta
		want []string
	}{
		{
			name: "no tags no aliases",
			meta: DocumentMeta{
				Project: "@test",
				Title:   "Simple",
				Tags:    []string{},
				Aliases: []string{},
				Created: created,
				Updated: updated,
			},
			want: []string{
				"title: Simple",
				"project: @test",
				"created:",
				"updated:",
			},
		},
		{
			name: "single tag single alias",
			meta: DocumentMeta{
				Project: "@test",
				Title:   "Test",
				Tags:    []string{"tag1"},
				Aliases: []string{"alias1"},
				Created: created,
				Updated: updated,
			},
			want: []string{
				"tags:",
				"  - tag1",
				"aliases:",
				"  - alias1",
			},
		},
		{
			name: "multiple tags and aliases",
			meta: DocumentMeta{
				Project: "@test",
				Title:   "Test",
				Tags:    []string{"tag1", "tag2", "tag3"},
				Aliases: []string{"alias1", "alias2"},
				Created: created,
				Updated: updated,
			},
			want: []string{
				"  - tag1",
				"  - tag2",
				"  - tag3",
				"  - alias1",
				"  - alias2",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			doc := &DocumentFile{
				Meta:   tt.meta,
				Blocks: []BlockNoteBlock{},
			}

			markdown, err := converter.ToMarkdown(doc)
			if err != nil {
				t.Fatalf("ToMarkdown() error: %v", err)
			}

			for _, expected := range tt.want {
				if !contains(markdown, expected) {
					t.Errorf("Expected markdown to contain '%s'", expected)
				}
			}
		})
	}
}

func TestMarkdownConverter_LinkInHeading(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Check "},
					{
						Type: "link",
						Content: []BlockNoteContent{
							{Type: "text", Text: "this"},
						},
						Href: "https://example.com",
					},
					{Type: "text", Text: " out"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "# Check [this](https://example.com) out") {
		t.Error("Expected link inside heading")
	}
}

func TestMarkdownConverter_FileWithoutName(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "file1",
				Type: "file",
				Props: map[string]any{
					"url": "path/to/file.pdf",
					// No name property
				},
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "[file](path/to/file.pdf)") {
		t.Error("Expected default 'file' text for file without name")
	}
}

func TestMarkdownConverter_ImageWithoutCaption(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "img1",
				Type: "image",
				Props: map[string]any{
					"url": "path/to/image.png",
					// No caption
				},
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "![](path/to/image.png)") {
		t.Error("Expected image markdown with empty caption")
	}
}

func TestMarkdownConverter_UnknownBlockType(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "unknown1",
				Type: "unknownBlockType",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Unknown content"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	// Unknown blocks should fall through to default case and extract text
	if !contains(markdown, "Unknown content") {
		t.Error("Expected unknown block text to be extracted")
	}
}

func TestMarkdownConverter_CodeBlockWithoutLanguage(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "code1",
				Type: "codeBlock",
				Props: map[string]any{
					// No language
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "code without language"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "```\ncode without language") {
		t.Error("Expected code block without language specifier")
	}
}

func TestMarkdownConverter_MixedListTypes(t *testing.T) {
	converter := NewMarkdownConverter()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "li1",
				Type: "bulletListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Bullet item"},
				}),
			},
			{
				ID:   "li2",
				Type: "numberedListItem",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Numbered item"},
				}),
			},
			{
				ID:   "li3",
				Type: "checkListItem",
				Props: map[string]any{
					"checked": true,
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Checked item"},
				}),
			},
		},
	}

	markdown, err := converter.ToMarkdown(doc)
	if err != nil {
		t.Fatalf("ToMarkdown() error: %v", err)
	}

	if !contains(markdown, "- Bullet item") {
		t.Error("Expected bullet list item")
	}

	if !contains(markdown, "1. Numbered item") {
		t.Error("Expected numbered list item")
	}

	if !contains(markdown, "- [x] Checked item") {
		t.Error("Expected checked checkbox item")
	}
}
