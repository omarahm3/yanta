package document

import (
	"testing"
	"time"
	"yanta/internal/project"
)

func TestValidateProjectAlias_WithAtSymbol(t *testing.T) {
	tests := []struct {
		name    string
		alias   string
		wantErr bool
	}{
		{
			name:    "invalid alias without @",
			alias:   "work",
			wantErr: true,
		},
		{
			name:    "valid alias with @",
			alias:   "@work",
			wantErr: false,
		},
		{
			name:    "valid alias @lps",
			alias:   "@lps",
			wantErr: false,
		},
		{
			name:    "valid alias @side",
			alias:   "@side",
			wantErr: false,
		},
		{
			name:    "invalid: too short with @",
			alias:   "@a",
			wantErr: true,
		},
		{
			name:    "invalid: uppercase",
			alias:   "@Work",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := project.ValidateAlias(tt.alias)
			if (err != nil) != tt.wantErr {
				t.Errorf("project.ValidateAlias(%q) error = %v, wantErr %v", tt.alias, err, tt.wantErr)
			}
		})
	}
}

func TestDocumentFile_WithAtSymbolProject(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name    string
		file    *DocumentFile
		wantErr bool
	}{
		{
			name: "valid document with @ prefix",
			file: &DocumentFile{
				Meta: DocumentMeta{
					Project: "@work",
					Title:   "Test Document",
					Tags:    []string{"tag1"},
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{},
			},
			wantErr: false,
		},
		{
			name: "valid document without @ prefix",
			file: &DocumentFile{
				Meta: DocumentMeta{
					Project: "work",
					Title:   "Test Document",
					Tags:    []string{"tag1"},
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{},
			},
			wantErr: true,
		},
		{
			name: "invalid: uppercase in @ prefix project",
			file: &DocumentFile{
				Meta: DocumentMeta{
					Project: "@Work",
					Title:   "Test Document",
					Tags:    []string{"tag1"},
					Created: now,
					Updated: now,
				},
				Blocks: []BlockNoteBlock{},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.file.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("DocumentFile.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
