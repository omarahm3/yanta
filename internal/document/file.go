package document

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"yanta/internal/project"
)

type DocumentFile struct {
	Meta   DocumentMeta     `json:"meta"`
	Blocks []BlockNoteBlock `json:"blocks"`
}

type DocumentMeta struct {
	Project string    `json:"project"`
	Title   string    `json:"title"`
	Tags    []string  `json:"tags"`
	Aliases []string  `json:"aliases,omitempty"`
	Created time.Time `json:"created" ts_type:"string"`
	Updated time.Time `json:"updated" ts_type:"string"`
}

type BlockNoteBlock struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Props    map[string]any     `json:"props,omitempty"`
	Content  []BlockNoteContent `json:"content,omitempty"`
	Children []BlockNoteBlock   `json:"children,omitempty"`
}

type BlockNoteContent struct {
	Type    string         `json:"type"`
	Text    string         `json:"text,omitempty"`
	Styles  map[string]any `json:"styles,omitempty"`
	Href    string         `json:"href,omitempty"`
	Content string         `json:"content,omitempty"`
}

func (df *DocumentFile) Validate() error {
	if err := df.Meta.Validate(); err != nil {
		return fmt.Errorf("meta validation failed: %w", err)
	}

	if df.Blocks == nil {
		return fmt.Errorf("blocks cannot be nil (use empty array for empty document)")
	}

	for i, block := range df.Blocks {
		if err := validateBlock(block, 0); err != nil {
			return fmt.Errorf("block %d validation failed: %w", i, err)
		}
	}

	return nil
}

func (m *DocumentMeta) Validate() error {
	if err := project.ValidateAlias(m.Project); err != nil {
		return fmt.Errorf("invalid project: %w", err)
	}

	if err := validateTitle(m.Title); err != nil {
		return fmt.Errorf("invalid title: %w", err)
	}

	if err := validateTags(m.Tags); err != nil {
		return fmt.Errorf("invalid tags: %w", err)
	}

	if err := validateAliases(m.Aliases); err != nil {
		return fmt.Errorf("invalid aliases: %w", err)
	}

	if err := validateTimestamps(m.Created, m.Updated); err != nil {
		return fmt.Errorf("invalid timestamps: %w", err)
	}

	return nil
}

func (m *DocumentMeta) NormalizeTags() {
	if len(m.Tags) == 0 {
		return
	}

	seen := make(map[string]bool)
	normalized := make([]string, 0, len(m.Tags))

	for _, tag := range m.Tags {
		lower := strings.ToLower(strings.TrimSpace(tag))
		if lower != "" && !seen[lower] {
			seen[lower] = true
			normalized = append(normalized, lower)
		}
	}

	m.Tags = normalized
}

func (df *DocumentFile) ToJSON() ([]byte, error) {
	df.Meta.NormalizeTags()

	data, err := json.MarshalIndent(df, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshaling document to JSON: %w", err)
	}

	return data, nil
}

func FromJSON(data []byte) (*DocumentFile, error) {
	var df DocumentFile

	if err := json.Unmarshal(data, &df); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON: %w", err)
	}

	df.Meta.NormalizeTags()

	if err := df.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	return &df, nil
}

func validateTitle(title string) error {
	if title == "" {
		return fmt.Errorf("title cannot be empty")
	}

	if len(title) > 512 {
		return fmt.Errorf("title cannot exceed 512 characters, got %d", len(title))
	}

	if strings.ContainsAny(title, "\n\r") {
		return fmt.Errorf("title cannot contain newlines")
	}

	return nil
}

func validateTags(tags []string) error {
	if tags == nil {
		return nil
	}

	seen := make(map[string]bool)

	for _, tag := range tags {
		normalized := strings.ToLower(strings.TrimSpace(tag))

		if normalized == "" {
			return fmt.Errorf("empty tag not allowed")
		}

		if len(normalized) > 64 {
			return fmt.Errorf("tag exceeds 64 characters: %s", tag)
		}

		if seen[normalized] {
			return fmt.Errorf("duplicate tag: %s", tag)
		}
		seen[normalized] = true

		for _, r := range normalized {
			if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
				return fmt.Errorf("invalid tag format (must be lowercase alphanumeric + underscore/hyphen): %s", tag)
			}
		}
	}

	return nil
}

func validateAliases(aliases []string) error {
	if len(aliases) == 0 {
		return nil
	}

	for _, alias := range aliases {
		if len(alias) < 2 || len(alias) > 128 {
			return fmt.Errorf("alias must be 2-128 characters: %s", alias)
		}

		for _, r := range alias {
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
				return fmt.Errorf("invalid alias format: %s", alias)
			}
		}
	}

	return nil
}

func validateTimestamps(created, updated time.Time) error {
	if created.IsZero() {
		return fmt.Errorf("created timestamp cannot be zero")
	}

	if updated.IsZero() {
		return fmt.Errorf("updated timestamp cannot be zero")
	}

	if updated.Before(created) {
		return fmt.Errorf("updated timestamp (%s) cannot be before created timestamp (%s)",
			updated.Format(time.RFC3339), created.Format(time.RFC3339))
	}

	now := time.Now().Add(time.Minute)
	if created.After(now) {
		return fmt.Errorf("created timestamp cannot be in the future")
	}
	if updated.After(now) {
		return fmt.Errorf("updated timestamp cannot be in the future")
	}

	return nil
}

func validateBlock(block BlockNoteBlock, depth int) error {
	const maxDepth = 20
	if depth > maxDepth {
		return fmt.Errorf("block nesting exceeds maximum depth of %d", maxDepth)
	}

	if block.ID == "" {
		return fmt.Errorf("block ID cannot be empty")
	}

	if block.Type == "" {
		return fmt.Errorf("block type cannot be empty")
	}

	for i, child := range block.Children {
		if err := validateBlock(child, depth+1); err != nil {
			return fmt.Errorf("child block %d: %w", i, err)
		}
	}

	return nil
}

func NewDocumentFile(project, title string, tags []string) *DocumentFile {
	now := time.Now()

	return &DocumentFile{
		Meta: DocumentMeta{
			Project: strings.ToLower(project),
			Title:   strings.TrimSpace(title),
			Tags:    tags,
			Aliases: []string{},
			Created: now,
			Updated: now,
		},
		Blocks: []BlockNoteBlock{},
	}
}

func (df *DocumentFile) UpdateTimestamp() {
	df.Meta.Updated = time.Now()
}
