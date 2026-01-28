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
