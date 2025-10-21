package tag

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

type Tag struct {
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	DeletedAt string `json:"deleted_at"`
}

func New(name string) (*Tag, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	normalized := Normalize(name)

	if err := Validate(normalized); err != nil {
		return nil, err
	}

	return &Tag{
		Name:      normalized,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		DeletedAt: "",
	}, nil
}

func Normalize(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.ReplaceAll(normalized, " ", "-")

	re := regexp.MustCompile(`[^a-z0-9_-]`)
	normalized = re.ReplaceAllString(normalized, "")

	normalized = regexp.MustCompile(`-+`).ReplaceAllString(normalized, "-")
	normalized = regexp.MustCompile(`_+`).ReplaceAllString(normalized, "_")
	normalized = strings.Trim(normalized, "-_")

	return normalized
}

func Validate(name string) error {
	if len(name) < 1 || len(name) > 64 {
		return fmt.Errorf("tag name must be 1-64 characters, got %d", len(name))
	}

	if name != strings.ToLower(name) {
		return fmt.Errorf("tag name must be lowercase")
	}

	match := regexp.MustCompile(`^[a-z0-9_-]+$`)
	if !match.MatchString(name) {
		return fmt.Errorf("tag name must contain only lowercase letters, numbers, underscores, and hyphens")
	}

	return nil
}

func (t *Tag) IsActive() bool {
	return t.DeletedAt == ""
}
