// Package journal provides quick capture journal functionality.
// See PRD: ~/tasks/yanta/quick-launch.md Section 7.4-7.6
package journal

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// MaxEntryContentLength is the maximum allowed length for entry content (10,000 chars per PRD)
const MaxEntryContentLength = 10000

// JournalEntry represents a single quick capture entry in a daily journal.
type JournalEntry struct {
	ID      string    `json:"id"`
	Content string    `json:"content"`
	Tags    []string  `json:"tags"`
	Created time.Time `json:"created"`
	Deleted bool      `json:"deleted,omitempty"`
}

// JournalMeta contains metadata for a daily journal file.
type JournalMeta struct {
	Project string    `json:"project"`
	Date    string    `json:"date"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// JournalFile represents a daily journal file containing multiple entries.
type JournalFile struct {
	Meta    JournalMeta    `json:"meta"`
	Entries []JournalEntry `json:"entries"`
}

// Validate checks if the journal entry is valid.
func (e *JournalEntry) Validate() error {
	if e.ID == "" {
		return fmt.Errorf("ID cannot be empty")
	}

	if strings.TrimSpace(e.Content) == "" {
		return fmt.Errorf("content cannot be empty")
	}

	if len(e.Content) > MaxEntryContentLength {
		return fmt.Errorf("content exceeds maximum length of %d characters", MaxEntryContentLength)
	}

	if e.Created.IsZero() {
		return fmt.Errorf("created timestamp cannot be zero")
	}

	return nil
}

// Validate checks if the journal file is valid.
func (f *JournalFile) Validate() error {
	if err := f.Meta.Validate(); err != nil {
		return fmt.Errorf("meta validation failed: %w", err)
	}

	for i, entry := range f.Entries {
		if err := entry.Validate(); err != nil {
			return fmt.Errorf("entry %d validation failed: %w", i, err)
		}
	}

	return nil
}

// Validate checks if the journal meta is valid.
func (m *JournalMeta) Validate() error {
	if m.Project == "" {
		return fmt.Errorf("project cannot be empty")
	}

	if m.Date == "" {
		return fmt.Errorf("date cannot be empty")
	}

	if err := ValidateDate(m.Date); err != nil {
		return err
	}

	return nil
}

// ValidateDate checks if a date string is in valid YYYY-MM-DD format.
func ValidateDate(date string) error {
	if date == "" {
		return fmt.Errorf("date cannot be empty")
	}

	_, err := time.Parse("2006-01-02", date)
	if err != nil {
		return fmt.Errorf("invalid date format (expected YYYY-MM-DD): %s", date)
	}

	return nil
}

// TodayDate returns today's date in YYYY-MM-DD format.
func TodayDate() string {
	return time.Now().Format("2006-01-02")
}

// NewJournalEntry creates a new journal entry with a generated ID and timestamp.
func NewJournalEntry(content string, tags []string) *JournalEntry {
	if tags == nil {
		tags = []string{}
	}

	// Generate 8-char short UUID per PRD spec
	id := strings.ReplaceAll(uuid.New().String(), "-", "")[:8]

	return &JournalEntry{
		ID:      id,
		Content: content,
		Tags:    tags,
		Created: time.Now(),
		Deleted: false,
	}
}

// NewJournalFile creates a new journal file for a given project and date.
func NewJournalFile(project, date string) *JournalFile {
	now := time.Now()

	return &JournalFile{
		Meta: JournalMeta{
			Project: project,
			Date:    date,
			Created: now,
			Updated: now,
		},
		Entries: []JournalEntry{},
	}
}

// MarkDeleted marks an entry as deleted (soft delete).
func (e *JournalEntry) MarkDeleted() {
	e.Deleted = true
}

// UpdateTimestamp updates the journal file's Updated timestamp.
func (f *JournalFile) UpdateTimestamp() {
	f.Meta.Updated = time.Now()
}

// GetEntry returns an entry by ID, or nil if not found.
func (f *JournalFile) GetEntry(id string) *JournalEntry {
	for i := range f.Entries {
		if f.Entries[i].ID == id {
			return &f.Entries[i]
		}
	}
	return nil
}

// AppendEntry adds a new entry to the journal file.
func (f *JournalFile) AppendEntry(entry *JournalEntry) {
	f.Entries = append(f.Entries, *entry)
	f.UpdateTimestamp()
}

// ActiveEntries returns all non-deleted entries.
func (f *JournalFile) ActiveEntries() []JournalEntry {
	var active []JournalEntry
	for _, e := range f.Entries {
		if !e.Deleted {
			active = append(active, e)
		}
	}
	return active
}

// JournalEntryWithProject wraps a JournalEntry with its project alias.
// Used when fetching entries from all projects.
type JournalEntryWithProject struct {
	JournalEntry
	ProjectAlias string `json:"projectAlias"`
}
