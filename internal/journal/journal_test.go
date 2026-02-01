package journal

import (
	"strings"
	"testing"
	"time"
)

func TestJournalEntry_Validate(t *testing.T) {
	tests := []struct {
		name    string
		entry   JournalEntry
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid entry",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: "Fix the auth bug",
				Tags:    []string{"urgent", "backend"},
				Created: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "valid entry with no tags",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: "Simple note",
				Tags:    []string{},
				Created: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "empty ID",
			entry: JournalEntry{
				ID:      "",
				Content: "Some content",
				Tags:    []string{},
				Created: time.Now(),
			},
			wantErr: true,
			errMsg:  "ID cannot be empty",
		},
		{
			name: "empty content",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: "",
				Tags:    []string{},
				Created: time.Now(),
			},
			wantErr: true,
			errMsg:  "content cannot be empty",
		},
		{
			name: "whitespace only content",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: "   \n\t  ",
				Tags:    []string{},
				Created: time.Now(),
			},
			wantErr: true,
			errMsg:  "content cannot be empty",
		},
		{
			name: "content too long",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: strings.Repeat("a", MaxEntryContentLength+1),
				Tags:    []string{},
				Created: time.Now(),
			},
			wantErr: true,
			errMsg:  "content exceeds maximum length",
		},
		{
			name: "zero created time",
			entry: JournalEntry{
				ID:      "a1b2c3d4",
				Content: "Some content",
				Tags:    []string{},
				Created: time.Time{},
			},
			wantErr: true,
			errMsg:  "created timestamp cannot be zero",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.entry.Validate()
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
					return
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestJournalFile_Validate(t *testing.T) {
	validEntry := JournalEntry{
		ID:      "a1b2c3d4",
		Content: "Test entry",
		Tags:    []string{},
		Created: time.Now(),
	}

	tests := []struct {
		name    string
		file    JournalFile
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid file",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "2026-01-30",
					Created: time.Now().Add(-time.Hour),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{validEntry},
			},
			wantErr: false,
		},
		{
			name: "valid file with empty entries",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "2026-01-30",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{},
			},
			wantErr: false,
		},
		{
			name: "invalid date format - wrong separator",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "2026/01/30",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{},
			},
			wantErr: true,
			errMsg:  "invalid date format",
		},
		{
			name: "invalid date format - invalid date",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "2026-13-45",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{},
			},
			wantErr: true,
			errMsg:  "invalid date format",
		},
		{
			name: "invalid date format - empty",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{},
			},
			wantErr: true,
			errMsg:  "date cannot be empty",
		},
		{
			name: "invalid project - empty",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "",
					Date:    "2026-01-30",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{},
			},
			wantErr: true,
			errMsg:  "project cannot be empty",
		},
		{
			name: "invalid entry in file",
			file: JournalFile{
				Meta: JournalMeta{
					Project: "@personal",
					Date:    "2026-01-30",
					Created: time.Now(),
					Updated: time.Now(),
				},
				Entries: []JournalEntry{
					{
						ID:      "a1b2c3d4",
						Content: "", // empty content
						Created: time.Now(),
					},
				},
			},
			wantErr: true,
			errMsg:  "content cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.file.Validate()
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errMsg)
					return
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("expected error containing %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestNewJournalEntry(t *testing.T) {
	content := "Fix the auth bug"
	tags := []string{"urgent", "backend"}

	entry := NewJournalEntry(content, tags)

	if entry.ID == "" {
		t.Error("expected non-empty ID")
	}
	if len(entry.ID) != 8 {
		t.Errorf("expected ID length 8, got %d", len(entry.ID))
	}
	if entry.Content != content {
		t.Errorf("expected content %q, got %q", content, entry.Content)
	}
	if len(entry.Tags) != len(tags) {
		t.Errorf("expected %d tags, got %d", len(tags), len(entry.Tags))
	}
	if entry.Created.IsZero() {
		t.Error("expected non-zero created time")
	}
	if entry.Deleted {
		t.Error("expected deleted to be false")
	}
}

func TestNewJournalFile(t *testing.T) {
	project := "@personal"
	date := "2026-01-30"

	file := NewJournalFile(project, date)

	if file.Meta.Project != project {
		t.Errorf("expected project %q, got %q", project, file.Meta.Project)
	}
	if file.Meta.Date != date {
		t.Errorf("expected date %q, got %q", date, file.Meta.Date)
	}
	if file.Meta.Created.IsZero() {
		t.Error("expected non-zero created time")
	}
	if file.Meta.Updated.IsZero() {
		t.Error("expected non-zero updated time")
	}
	if len(file.Entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(file.Entries))
	}
}

func TestJournalEntry_MarkDeleted(t *testing.T) {
	entry := NewJournalEntry("Test content", nil)

	if entry.Deleted {
		t.Error("expected deleted to be false initially")
	}

	entry.MarkDeleted()

	if !entry.Deleted {
		t.Error("expected deleted to be true after MarkDeleted")
	}
}

func TestValidateDate(t *testing.T) {
	tests := []struct {
		date    string
		wantErr bool
	}{
		{"2026-01-30", false},
		{"2024-12-31", false},
		{"2023-01-01", false},
		{"2026/01/30", true},
		{"2026-13-01", true},
		{"2026-00-01", true},
		{"2026-01-32", true},
		{"", true},
		{"invalid", true},
		{"26-01-30", true},
	}

	for _, tt := range tests {
		t.Run(tt.date, func(t *testing.T) {
			err := ValidateDate(tt.date)
			if tt.wantErr && err == nil {
				t.Errorf("expected error for date %q", tt.date)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error for date %q: %v", tt.date, err)
			}
		})
	}
}

func TestTodayDate(t *testing.T) {
	date := TodayDate()
	now := time.Now()
	expected := now.Format("2006-01-02")

	if date != expected {
		t.Errorf("expected %q, got %q", expected, date)
	}
}
