package vault

import (
	"fmt"
	"path"
	"regexp"
	"strings"
)

var aliasContentPattern = regexp.MustCompile(`^[a-z0-9-]+$`)

func NormalizeDocumentPath(docPath string) string {
	docPath = strings.TrimSpace(docPath)
	if docPath == "" {
		return ""
	}

	normalized := strings.ReplaceAll(docPath, "\\", "/")
	normalized = strings.TrimPrefix(normalized, "./")
	normalized = strings.TrimPrefix(normalized, "/")
	normalized = strings.ReplaceAll(normalized, "//", "/")

	cleanPath := path.Clean(normalized)
	if cleanPath == "." {
		return ""
	}

	return cleanPath
}

func ValidateDocumentPath(docPath string) error {
	if docPath == "" {
		return fmt.Errorf("path cannot be empty")
	}

	if strings.Contains(docPath, "..") {
		return fmt.Errorf("path contains directory traversal: %s", docPath)
	}

	cleanPath := NormalizeDocumentPath(docPath)
	if cleanPath == "" {
		return fmt.Errorf("path cannot be empty")
	}

	if !strings.HasPrefix(cleanPath, "projects/") {
		return fmt.Errorf("path must start with 'projects/', got: %s", cleanPath)
	}

	if !strings.HasSuffix(cleanPath, ".json") {
		return fmt.Errorf("path must end with '.json', got: %s", cleanPath)
	}

	dir := path.Dir(cleanPath)
	projectAlias := path.Base(dir)

	if projectAlias == "" || projectAlias == "." || projectAlias == ".." || projectAlias == "projects" {
		return fmt.Errorf("invalid project alias in path: %s", cleanPath)
	}

	return nil
}

func SanitizeProjectAlias(alias string) string {
	alias = strings.TrimSpace(alias)
	alias = strings.TrimPrefix(alias, "@")
	alias = strings.ToLower(alias)

	unsafe := []string{"/", "\\", "<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range unsafe {
		alias = strings.ReplaceAll(alias, char, "-")
	}

	alias = strings.Trim(alias, "-")

	if alias == "" {
		return ""
	}

	return "@" + alias
}

func validateProjectAlias(alias string) error {
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

func GenerateDocumentPath(projectAlias, documentID string) (string, error) {
	if err := validateProjectAlias(projectAlias); err != nil {
		return "", fmt.Errorf("invalid project alias: %w", err)
	}

	if documentID == "" {
		return "", fmt.Errorf("document ID cannot be empty")
	}

	aliasSlug := strings.TrimPrefix(projectAlias, "@")
	filename := fmt.Sprintf("doc-%s-%s.json", aliasSlug, documentID)
	docPath := path.Join("projects", projectAlias, filename)

	return docPath, nil
}
