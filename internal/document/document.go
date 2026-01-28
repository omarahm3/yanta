// Package document provides document types, storage, and manipulation functionality.
package document

import (
	"fmt"
	"strings"
	"time"

	"yanta/internal/project"
	"yanta/internal/vault"
)

type Document struct {
	Path             string   `json:"path"`
	ProjectAlias     string   `json:"project_alias"`
	Title            string   `json:"title"`
	ModificationTime int64    `json:"mtime_ns"`
	Size             int64    `json:"size_bytes"`
	HasCode          bool     `json:"has_code"`
	HasImages        bool     `json:"has_images"`
	HasLinks         bool     `json:"has_links"`
	CreatedAt        string   `json:"created_at"`
	UpdatedAt        string   `json:"updated_at"`
	DeletedAt        string   `json:"deleted_at"`
	Tags             []string `json:"tags"`
}

type Option func(*Document)

func New(path, projectAlias, title string, opts ...Option) *Document {
	doc := &Document{
		Path:         path,
		ProjectAlias: projectAlias,
		Title:        title,
		CreatedAt:    time.Now().Format(time.RFC3339),
		UpdatedAt:    time.Now().Format(time.RFC3339),
		DeletedAt:    "",
	}

	for _, opt := range opts {
		opt(doc)
	}

	return doc
}

func WithModificationTime(mtime int64) Option {
	return func(d *Document) { d.ModificationTime = mtime }
}

func WithSize(size int64) Option {
	return func(d *Document) { d.Size = size }
}

func WithMetadata(hasCode, hasImages, hasLinks bool) Option {
	return func(d *Document) {
		d.HasCode = hasCode
		d.HasImages = hasImages
		d.HasLinks = hasLinks
	}
}

func WithTimestamps(createdAt, updatedAt, deletedAt string) Option {
	return func(d *Document) {
		d.CreatedAt = createdAt
		d.UpdatedAt = updatedAt
		d.DeletedAt = deletedAt
	}
}

func ValidatePath(path string) error {
	if path == "" {
		return fmt.Errorf("path is required")
	}

	if strings.Contains(path, "..") {
		return fmt.Errorf("path must not contain directory traversal (..)")
	}

	normalized := vault.NormalizeDocumentPath(path)
	if normalized == "" {
		return fmt.Errorf("path is required")
	}

	if !strings.HasPrefix(normalized, "projects/") {
		return fmt.Errorf("path must start with 'projects/'")
	}

	if !strings.HasSuffix(normalized, ".json") {
		return fmt.Errorf("path must end with '.json'")
	}

	return nil
}

func Validate(d *Document) error {
	if err := ValidatePath(d.Path); err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}

	if err := project.ValidateAlias(d.ProjectAlias); err != nil {
		return fmt.Errorf("invalid project_alias: %w", err)
	}

	if d.Size < 0 {
		return fmt.Errorf("size_bytes must be non-negative")
	}

	if d.ModificationTime < 0 {
		return fmt.Errorf("mtime_ns must be non-negative")
	}

	return nil
}

func (d *Document) BelongsToProject(alias string) bool {
	return d.ProjectAlias == alias
}

func (d *Document) IsDeleted() bool {
	return d.DeletedAt != ""
}

func (d *Document) IsActive() bool {
	return d.DeletedAt == ""
}
