package document

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func mustMarshalContent(content []BlockNoteContent) json.RawMessage {
	data, err := json.Marshal(content)
	if err != nil {
		panic(err)
	}
	return data
}

func TestDocumentMeta_Validate(t *testing.T) {
	tests := []struct {
		name    string
		meta    DocumentMeta
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid metadata",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "Test Document",
				Tags:    []string{"test", "docs"},
				Created: time.Now().Add(-time.Hour),
				Updated: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "empty project",
			meta: DocumentMeta{
				Project: "",
				Title:   "Test",
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "alias must start with @",
		},
		{
			name: "invalid project with uppercase",
			meta: DocumentMeta{
				Project: "@Yanta",
				Title:   "Test",
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "alias must contain only lowercase letters, numbers, and hyphens after @",
		},
		{
			name: "empty title",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "",
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "title cannot be empty",
		},
		{
			name: "title too long",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   strings.Repeat("a", 513),
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "title cannot exceed 512 characters",
		},
		{
			name: "title with newline",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "Test\nDocument",
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "title cannot contain newlines",
		},
		{
			name: "duplicate tags",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "Test",
				Tags:    []string{"test", "test"},
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "duplicate tag",
		},
		{
			name: "invalid tag characters",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "Test",
				Tags:    []string{"test@tag"},
				Created: time.Now(),
				Updated: time.Now(),
			},
			wantErr: true,
			errMsg:  "invalid tag format",
		},
		{
			name: "updated before created",
			meta: DocumentMeta{
				Project: "@yanta",
				Title:   "Test",
				Created: time.Now(),
				Updated: time.Now().Add(-time.Hour),
			},
			wantErr: true,
			errMsg:  "cannot be before created",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.meta.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("Validate() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestDocumentMeta_NormalizeTags(t *testing.T) {
	tests := []struct {
		name     string
		tags     []string
		expected []string
	}{
		{
			name:     "normalize to lowercase",
			tags:     []string{"Test", "DOCS", "Go"},
			expected: []string{"test", "docs", "go"},
		},
		{
			name:     "remove duplicates",
			tags:     []string{"test", "Test", "TEST"},
			expected: []string{"test"},
		},
		{
			name:     "trim spaces",
			tags:     []string{" test ", "docs  "},
			expected: []string{"test", "docs"},
		},
		{
			name:     "empty tags",
			tags:     []string{},
			expected: []string{},
		},
		{
			name:     "remove empty strings",
			tags:     []string{"test", "", "docs"},
			expected: []string{"test", "docs"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := DocumentMeta{Tags: tt.tags}
			meta.NormalizeTags()

			if len(meta.Tags) != len(tt.expected) {
				t.Errorf("NormalizeTags() got %d tags, want %d", len(meta.Tags), len(tt.expected))
				return
			}

			for i, tag := range meta.Tags {
				if tag != tt.expected[i] {
					t.Errorf("NormalizeTags() tag[%d] = %q, want %q", i, tag, tt.expected[i])
				}
			}
		})
	}
}

func TestDocumentFile_Validate(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name    string
		file    DocumentFile
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid document",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "@yanta",
					Title:   "Test Doc",
					Tags:    []string{"test"},
					Created: now.Add(-time.Hour),
					Updated: now,
				},
				Blocks: []BlockNoteBlock{},
			},
			wantErr: false,
		},
		{
			name: "valid document with blocks",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "@yanta",
					Title:   "Test Doc",
					Created: now.Add(-time.Hour),
					Updated: now,
				},
				Blocks: []BlockNoteBlock{
					{
						ID:      "block1",
						Type:    "heading",
						Props:   map[string]any{"level": 1},
						Content: mustMarshalContent([]BlockNoteContent{{Type: "text", Text: "Title"}}),
					},
					{
						ID:      "block2",
						Type:    "paragraph",
						Content: mustMarshalContent([]BlockNoteContent{{Type: "text", Text: "Content"}}),
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid meta",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "",
					Title:   "Test",
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{},
			},
			wantErr: true,
			errMsg:  "meta validation failed",
		},
		{
			name: "nil blocks",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "@yanta",
					Title:   "Test",
					Created: now,
					Updated: now,
				},
				Blocks: nil,
			},
			wantErr: true,
			errMsg:  "blocks cannot be nil",
		},
		{
			name: "block missing ID",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "@yanta",
					Title:   "Test",
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{
					{
						Type: "paragraph",
					},
				},
			},
			wantErr: true,
			errMsg:  "block ID cannot be empty",
		},
		{
			name: "block missing type",
			file: DocumentFile{
				Meta: DocumentMeta{
					Project: "@yanta",
					Title:   "Test",
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{
					{
						ID: "block1",
					},
				},
			},
			wantErr: true,
			errMsg:  "block type cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.file.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("Validate() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestDocumentFile_ToJSON_FromJSON(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	original := &DocumentFile{
		Meta: DocumentMeta{
			Project: "@yanta",
			Title:   "Test Document",
			Tags:    []string{"test", "docs"},
			Aliases: []string{"test-doc"},
			Created: now.Add(-time.Hour),
			Updated: now,
		},
		Blocks: []BlockNoteBlock{
			{
				ID:   "block1",
				Type: "heading",
				Props: map[string]any{
					"level": float64(1),
				},
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Test Title"},
				}),
				Children: []BlockNoteBlock{},
			},
			{
				ID:   "block2",
				Type: "paragraph",
				Content: mustMarshalContent([]BlockNoteContent{
					{Type: "text", Text: "Paragraph text with "},
					{Type: "text", Text: "bold", Styles: map[string]any{"bold": true}},
				}),
				Children: []BlockNoteBlock{},
			},
		},
	}

	jsonData, err := original.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON() error = %v", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(jsonData, &raw); err != nil {
		t.Fatalf("Generated JSON is invalid: %v", err)
	}

	parsed, err := FromJSON(jsonData)
	if err != nil {
		t.Fatalf("FromJSON() error = %v", err)
	}

	if parsed.Meta.Project != original.Meta.Project {
		t.Errorf("Project mismatch: got %q, want %q", parsed.Meta.Project, original.Meta.Project)
	}
	if parsed.Meta.Title != original.Meta.Title {
		t.Errorf("Title mismatch: got %q, want %q", parsed.Meta.Title, original.Meta.Title)
	}
	if len(parsed.Meta.Tags) != len(original.Meta.Tags) {
		t.Errorf("Tags length mismatch: got %d, want %d", len(parsed.Meta.Tags), len(original.Meta.Tags))
	}

	if !parsed.Meta.Created.Truncate(time.Second).Equal(original.Meta.Created.Truncate(time.Second)) {
		t.Errorf("Created timestamp mismatch: got %v, want %v", parsed.Meta.Created, original.Meta.Created)
	}
	if !parsed.Meta.Updated.Truncate(time.Second).Equal(original.Meta.Updated.Truncate(time.Second)) {
		t.Errorf("Updated timestamp mismatch: got %v, want %v", parsed.Meta.Updated, original.Meta.Updated)
	}

	if len(parsed.Blocks) != len(original.Blocks) {
		t.Errorf("Blocks length mismatch: got %d, want %d", len(parsed.Blocks), len(original.Blocks))
	}
}

func TestNewDocumentFile(t *testing.T) {
	project := "yanta"
	title := "Test Document"
	tags := []string{"test", "docs"}

	df := NewDocumentFile(project, title, tags)

	if df.Meta.Project != project {
		t.Errorf("Project = %q, want %q", df.Meta.Project, project)
	}
	if df.Meta.Title != title {
		t.Errorf("Title = %q, want %q", df.Meta.Title, title)
	}
	if len(df.Meta.Tags) != len(tags) {
		t.Errorf("Tags length = %d, want %d", len(df.Meta.Tags), len(tags))
	}
	if df.Meta.Created.IsZero() {
		t.Error("Created timestamp is zero")
	}
	if df.Meta.Updated.IsZero() {
		t.Error("Updated timestamp is zero")
	}
	if len(df.Blocks) != 0 {
		t.Errorf("Blocks length = %d, want 0", len(df.Blocks))
	}
}

func TestDocumentFile_UpdateTimestamp(t *testing.T) {
	df := NewDocumentFile("yanta", "Test", []string{})

	original := df.Meta.Updated
	time.Sleep(10 * time.Millisecond)

	df.UpdateTimestamp()

	if !df.Meta.Updated.After(original) {
		t.Errorf("Updated timestamp not updated: original=%v, new=%v", original, df.Meta.Updated)
	}
}

func TestValidateBlock_MaxDepth(t *testing.T) {
	root := BlockNoteBlock{
		ID:   "root",
		Type: "paragraph",
	}

	current := &root
	for i := 0; i < 25; i++ {
		child := BlockNoteBlock{
			ID:   "child",
			Type: "paragraph",
		}
		current.Children = []BlockNoteBlock{child}
		current = &current.Children[0]
	}

	err := validateBlock(root, 0)
	if err == nil {
		t.Error("validateBlock() should fail for excessive nesting")
	}
	if !strings.Contains(err.Error(), "exceeds maximum depth") {
		t.Errorf("validateBlock() error = %v, want error about max depth", err)
	}
}
