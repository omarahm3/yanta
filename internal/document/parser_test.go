package document

import (
	"testing"
	"time"
)

func TestParser_ParseHeading(t *testing.T) {
	p := NewParser()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Original Title",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": 1,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "First Heading"},
				},
			},
			{
				ID:   "h2",
				Type: "heading",
				Props: map[string]any{
					"level": 2,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "Second Heading"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Should use meta.title, not first heading
	if content.Title != "Original Title" {
		t.Errorf("Expected title 'Original Title', got '%s'", content.Title)
	}

	// Should extract both headings
	if len(content.Headings) != 2 {
		t.Errorf("Expected 2 headings, got %d", len(content.Headings))
	}

	if content.Headings[0] != "First Heading" {
		t.Errorf("Expected first heading 'First Heading', got '%s'", content.Headings[0])
	}
}

func TestParser_ParseParagraph(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "This is "},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
					{Type: "text", Text: " text."},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Body) != 1 {
		t.Fatalf("Expected 1 body paragraph, got %d", len(content.Body))
	}

	expected := "This is bold text."
	if content.Body[0] != expected {
		t.Errorf("Expected body '%s', got '%s'", expected, content.Body[0])
	}
}

func TestParser_ParseCodeBlock(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: codeText},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if !content.HasCode {
		t.Error("Expected HasCode to be true")
	}

	if len(content.Code) != 1 {
		t.Fatalf("Expected 1 code block, got %d", len(content.Code))
	}

	if content.Code[0] != codeText {
		t.Errorf("Code content mismatch.\nExpected:\n%s\nGot:\n%s", codeText, content.Code[0])
	}
}

func TestParser_ParseLinks(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "Check out "},
					{
						Type:    "link",
						Content: "GitHub",
						Href:    "https://github.com/example/repo",
					},
					{Type: "text", Text: " for more."},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if !content.HasLinks {
		t.Error("Expected HasLinks to be true")
	}

	if len(content.Links) != 1 {
		t.Fatalf("Expected 1 link, got %d", len(content.Links))
	}

	link := content.Links[0]
	if link.URL != "https://github.com/example/repo" {
		t.Errorf("Expected URL 'https://github.com/example/repo', got '%s'", link.URL)
	}

	if link.Host != "github.com" {
		t.Errorf("Expected host 'github.com', got '%s'", link.Host)
	}

	// Body should include link text
	expected := "Check out GitHub for more."
	if content.Body[0] != expected {
		t.Errorf("Expected body '%s', got '%s'", expected, content.Body[0])
	}
}

func TestParser_ParseImage(t *testing.T) {
	p := NewParser()

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
					"url":     "projects/@test/assets/abc123.png",
					"caption": "Architecture diagram",
					"width":   800,
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if !content.HasImages {
		t.Error("Expected HasImages to be true")
	}

	if len(content.Assets) != 1 {
		t.Fatalf("Expected 1 asset, got %d", len(content.Assets))
	}

	asset := content.Assets[0]
	if asset.Path != "projects/@test/assets/abc123.png" {
		t.Errorf("Expected path 'projects/@test/assets/abc123.png', got '%s'", asset.Path)
	}

	if asset.Caption != "Architecture diagram" {
		t.Errorf("Expected caption 'Architecture diagram', got '%s'", asset.Caption)
	}

	// Caption should be added to body for searchability
	if len(content.Body) != 1 || content.Body[0] != "Architecture diagram" {
		t.Error("Expected caption to be added to body")
	}
}

func TestParser_ParseListItem(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "First item"},
				},
				Children: []BlockNoteBlock{
					{
						ID:   "li2",
						Type: "bulletListItem",
						Content: []BlockNoteContent{
							{Type: "text", Text: "Nested item"},
						},
					},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Should extract both parent and nested items
	if len(content.Body) != 2 {
		t.Fatalf("Expected 2 body items, got %d", len(content.Body))
	}

	if content.Body[0] != "First item" {
		t.Errorf("Expected 'First item', got '%s'", content.Body[0])
	}

	if content.Body[1] != "Nested item" {
		t.Errorf("Expected 'Nested item', got '%s'", content.Body[1])
	}
}

func TestParser_FallbackTitle(t *testing.T) {
	p := NewParser()

	// No title in meta
	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "", // Empty
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": 1,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "Document Title From H1"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Should use first H1 as title
	if content.Title != "Document Title From H1" {
		t.Errorf("Expected title from H1, got '%s'", content.Title)
	}
}

func TestParser_EmptyDocument(t *testing.T) {
	p := NewParser()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Empty Doc",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{}, // No blocks
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if content.Title != "Empty Doc" {
		t.Errorf("Expected title 'Empty Doc', got '%s'", content.Title)
	}

	if content.HasCode || content.HasImages || content.HasLinks {
		t.Error("Empty document should have all flags false")
	}

	if len(content.Headings) != 0 || len(content.Body) != 0 {
		t.Error("Empty document should have no extracted content")
	}
}

func TestParser_FTSOutput(t *testing.T) {
	p := NewParser()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "FTS Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": 1,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "Heading One"},
				},
			},
			{
				ID:   "h2",
				Type: "heading",
				Props: map[string]any{
					"level": 2,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "Heading Two"},
				},
			},
			{
				ID:   "p1",
				Type: "paragraph",
				Content: []BlockNoteContent{
					{Type: "text", Text: "Body paragraph one."},
				},
			},
			{
				ID:   "p2",
				Type: "paragraph",
				Content: []BlockNoteContent{
					{Type: "text", Text: "Body paragraph two."},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Test FTS output methods
	if content.FTSTitle() != "FTS Test" {
		t.Errorf("FTSTitle() = '%s', expected 'FTS Test'", content.FTSTitle())
	}

	expectedHeadings := "Heading One Heading Two"
	if content.FTSHeadings() != expectedHeadings {
		t.Errorf("FTSHeadings() = '%s', expected '%s'", content.FTSHeadings(), expectedHeadings)
	}

	expectedBody := "Body paragraph one. Body paragraph two."
	if content.FTSBody() != expectedBody {
		t.Errorf("FTSBody() = '%s', expected '%s'", content.FTSBody(), expectedBody)
	}
}

func TestParser_ParseQuote(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "This is a quote."},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Body) != 1 {
		t.Fatalf("Expected 1 body item, got %d", len(content.Body))
	}

	if content.Body[0] != "This is a quote." {
		t.Errorf("Expected 'This is a quote.', got '%s'", content.Body[0])
	}
}

func TestParser_ParseFile(t *testing.T) {
	p := NewParser()

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

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Assets) != 1 {
		t.Fatalf("Expected 1 asset, got %d", len(content.Assets))
	}

	asset := content.Assets[0]
	if asset.Path != "projects/@test/assets/document.pdf" {
		t.Errorf("Expected path 'projects/@test/assets/document.pdf', got '%s'", asset.Path)
	}

	if asset.Caption != "Important Document" {
		t.Errorf("Expected caption 'Important Document', got '%s'", asset.Caption)
	}

	// Name should be added to body
	if len(content.Body) != 1 || content.Body[0] != "Important Document" {
		t.Error("Expected file name to be added to body")
	}
}

func TestParser_ParseTable(t *testing.T) {
	p := NewParser()

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
				Props: map[string]any{
					"content": []any{
						map[string]any{
							"cells": []any{
								map[string]any{"text": "Header 1"},
								map[string]any{"text": "Header 2"},
							},
						},
						map[string]any{
							"cells": []any{
								map[string]any{"text": "Cell 1"},
								map[string]any{"text": "Cell 2"},
							},
						},
					},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Body) != 1 {
		t.Fatalf("Expected 1 body item from table, got %d", len(content.Body))
	}

	expected := "Header 1 Header 2 Cell 1 Cell 2"
	if content.Body[0] != expected {
		t.Errorf("Expected table text '%s', got '%s'", expected, content.Body[0])
	}
}

func TestParser_ParseNumberedList(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "First numbered item"},
				},
			},
			{
				ID:   "li2",
				Type: "numberedListItem",
				Content: []BlockNoteContent{
					{Type: "text", Text: "Second numbered item"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Body) != 2 {
		t.Fatalf("Expected 2 body items, got %d", len(content.Body))
	}

	if content.Body[0] != "First numbered item" {
		t.Errorf("Expected 'First numbered item', got '%s'", content.Body[0])
	}

	if content.Body[1] != "Second numbered item" {
		t.Errorf("Expected 'Second numbered item', got '%s'", content.Body[1])
	}
}

func TestParser_ParseCheckList(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "Task to complete"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(content.Body) != 1 {
		t.Fatalf("Expected 1 body item, got %d", len(content.Body))
	}

	if content.Body[0] != "Task to complete" {
		t.Errorf("Expected 'Task to complete', got '%s'", content.Body[0])
	}
}

func TestParser_UnknownBlockType(t *testing.T) {
	p := NewParser()

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
				Content: []BlockNoteContent{
					{Type: "text", Text: "Some content"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Unknown blocks should still extract text to body
	if len(content.Body) != 1 {
		t.Fatalf("Expected 1 body item from unknown block, got %d", len(content.Body))
	}

	if content.Body[0] != "Some content" {
		t.Errorf("Expected 'Some content', got '%s'", content.Body[0])
	}
}

func TestIsAssetPath(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{
			name: "valid asset path",
			path: "projects/yanta/assets/abc123.png",
			want: true,
		},
		{
			name: "document path",
			path: "projects/yanta/doc-123.json",
			want: false,
		},
		{
			name: "external URL",
			path: "https://example.com/image.png",
			want: false,
		},
		{
			name: "empty",
			path: "",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsAssetPath(tt.path)
			if got != tt.want {
				t.Errorf("IsAssetPath(%s) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestIsExternalURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{
			name: "https URL",
			url:  "https://github.com",
			want: true,
		},
		{
			name: "http URL",
			url:  "http://example.com",
			want: true,
		},
		{
			name: "mailto",
			url:  "mailto:test@example.com",
			want: true,
		},
		{
			name: "asset path",
			url:  "projects/@test/assets/img.png",
			want: false,
		},
		{
			name: "relative asset",
			url:  "assets/img.png",
			want: false,
		},
		{
			name: "empty",
			url:  "",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsExternalURL(tt.url)
			if got != tt.want {
				t.Errorf("IsExternalURL(%s) = %v, want %v", tt.url, got, tt.want)
			}
		})
	}
}

func TestDeduplicateLinks(t *testing.T) {
	links := []Link{
		{URL: "https://github.com", Host: "github.com"},
		{URL: "https://example.com", Host: "example.com"},
		{URL: "https://github.com", Host: "github.com"}, // Duplicate
		{URL: "https://google.com", Host: "google.com"},
	}

	unique := DeduplicateLinks(links)

	if len(unique) != 3 {
		t.Errorf("Expected 3 unique links, got %d", len(unique))
	}

	// Check order preserved
	if unique[0].URL != "https://github.com" {
		t.Errorf("Expected first link to be github.com")
	}
}

func TestDeduplicateAssets(t *testing.T) {
	assets := []Asset{
		{Path: "projects/@test/assets/img1.png", Caption: "Image 1"},
		{Path: "projects/@test/assets/img2.png", Caption: "Image 2"},
		{Path: "projects/@test/assets/img1.png", Caption: "Duplicate"},
		{Path: "projects/@test/assets/img3.png", Caption: "Image 3"},
	}

	unique := DeduplicateAssets(assets)

	if len(unique) != 3 {
		t.Errorf("Expected 3 unique assets, got %d", len(unique))
	}

	// Check order preserved
	if unique[0].Path != "projects/@test/assets/img1.png" {
		t.Errorf("Expected first asset to be img1.png")
	}
}

func TestNormalizeAssetPath(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{
			name: "already normalized",
			path: "projects/@test/assets/img.png",
			want: "projects/@test/assets/img.png",
		},
		{
			name: "leading slash",
			path: "/projects/@test/assets/img.png",
			want: "projects/@test/assets/img.png",
		},
		{
			name: "backslashes",
			path: "projects\\@test\\assets\\img.png",
			want: "projects/@test/assets/img.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeAssetPath(tt.path)
			if got != tt.want {
				t.Errorf("NormalizeAssetPath(%s) = %s, want %s", tt.path, got, tt.want)
			}
		})
	}
}

func TestParser_ComplexDocument(t *testing.T) {
	p := NewParser()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Complex Document",
			Tags:    []string{"tag1", "tag2"},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "h1",
				Type: "heading",
				Props: map[string]any{
					"level": 1,
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "Main Heading"},
				},
			},
			{
				ID:   "p1",
				Type: "paragraph",
				Content: []BlockNoteContent{
					{Type: "text", Text: "This paragraph has a "},
					{Type: "link", Content: "link", Href: "https://example.com"},
					{Type: "text", Text: "."},
				},
			},
			{
				ID:   "code1",
				Type: "codeBlock",
				Props: map[string]any{
					"language": "python",
				},
				Content: []BlockNoteContent{
					{Type: "text", Text: "print('hello')"},
				},
			},
			{
				ID:   "img1",
				Type: "image",
				Props: map[string]any{
					"url":     "projects/@test/assets/diagram.png",
					"caption": "System diagram",
				},
			},
			{
				ID:   "list1",
				Type: "bulletListItem",
				Content: []BlockNoteContent{
					{Type: "text", Text: "List item"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// Verify all flags are set
	if !content.HasCode {
		t.Error("Expected HasCode to be true")
	}
	if !content.HasImages {
		t.Error("Expected HasImages to be true")
	}
	if !content.HasLinks {
		t.Error("Expected HasLinks to be true")
	}

	// Verify extracted content
	if len(content.Headings) != 1 {
		t.Errorf("Expected 1 heading, got %d", len(content.Headings))
	}
	if len(content.Body) != 3 {
		t.Errorf("Expected 3 body items (paragraph, caption, list), got %d", len(content.Body))
	}
	if len(content.Code) != 1 {
		t.Errorf("Expected 1 code block, got %d", len(content.Code))
	}
	if len(content.Links) != 1 {
		t.Errorf("Expected 1 link, got %d", len(content.Links))
	}
	if len(content.Assets) != 1 {
		t.Errorf("Expected 1 asset, got %d", len(content.Assets))
	}
}

func TestParser_FTSCodeFormat(t *testing.T) {
	p := NewParser()

	doc := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@test",
			Title:   "Code Test",
			Tags:    []string{},
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "code1",
				Type: "codeBlock",
				Content: []BlockNoteContent{
					{Type: "text", Text: "first block"},
				},
			},
			{
				ID:   "code2",
				Type: "codeBlock",
				Content: []BlockNoteContent{
					{Type: "text", Text: "second block"},
				},
			},
		},
	}

	content, err := p.Parse(doc)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	// FTSCode should join with double newlines
	expected := "first block\n\nsecond block"
	if content.FTSCode() != expected {
		t.Errorf("FTSCode() = '%s', expected '%s'", content.FTSCode(), expected)
	}
}
