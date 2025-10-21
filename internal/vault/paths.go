package vault

import (
	"fmt"
	"path"
	"strings"
	"yanta/internal/project"
)

func ValidateDocumentPath(docPath string) error {
	if docPath == "" {
		return fmt.Errorf("path cannot be empty")
	}

	if strings.Contains(docPath, "..") {
		return fmt.Errorf("path contains directory traversal: %s", docPath)
	}

	cleanPath := path.Clean(docPath)

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

func GenerateDocumentPath(projectAlias, documentID string) (string, error) {
	if err := project.ValidateAlias(projectAlias); err != nil {
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
