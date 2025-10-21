package project

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	multiHyphenPattern  = regexp.MustCompile(`-+`)
	invalidAliasPattern = regexp.MustCompile(`[^a-z0-9-]`)
	aliasContentPattern = regexp.MustCompile(`^[a-z0-9-]+$`)
)

type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Alias     string `json:"alias"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	DeletedAt string `json:"deleted_at"`
}

func New(name, alias, startDate, endDate string) (*Project, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	normalizedAliasInput := strings.TrimSpace(alias)
	if normalizedAliasInput == "" {
		normalizedAliasInput = name
	}

	normalizedAlias := NormalizeAlias(normalizedAliasInput)
	if err := ValidateAlias(normalizedAlias); err != nil {
		return nil, fmt.Errorf("invalid alias: %w", err)
	}

	return &Project{
		ID:        uuid.New().String(),
		Name:      name,
		Alias:     normalizedAlias,
		StartDate: startDate,
		EndDate:   endDate,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		DeletedAt: "",
	}, nil
}

func NormalizeAlias(name string) string {
	alias := strings.TrimSpace(name)

	alias = strings.TrimPrefix(alias, "@")
	alias = strings.ToLower(alias)

	alias = strings.ReplaceAll(alias, " ", "-")
	alias = strings.ReplaceAll(alias, "/", "-")
	alias = strings.ReplaceAll(alias, "_", "-")

	alias = invalidAliasPattern.ReplaceAllString(alias, "-")
	alias = multiHyphenPattern.ReplaceAllString(alias, "-")

	alias = strings.Trim(alias, "-")

	if alias == "" {
		return ""
	}

	return "@" + alias
}

func ValidateAlias(alias string) error {
	if !strings.HasPrefix(alias, "@") {
		return fmt.Errorf("alias must start with @")
	}

	aliasContent := alias[1:]
	if len(aliasContent) < 2 || len(aliasContent) > 32 {
		return fmt.Errorf("alias must be 2-32 characters (excluding @ prefix), got %d", len(aliasContent))
	}

	if !aliasContentPattern.MatchString(aliasContent) {
		return fmt.Errorf("alias must contain only lowercase letters, numbers, and hyphens after @")
	}

	return nil
}

func Validate(p *Project) error {
	if p.Name == "" {
		return fmt.Errorf("name is required")
	}

	if err := ValidateAlias(p.Alias); err != nil {
		return fmt.Errorf("invalid alias: %w", err)
	}

	return nil
}

func (p *Project) IsActive() bool {
	return p.DeletedAt == ""
}

func (p *Project) IsArchived() bool {
	return p.DeletedAt != ""
}
