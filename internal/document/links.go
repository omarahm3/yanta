package document

import (
	"strings"
)

func IsAssetPath(path string) bool {
	return strings.HasPrefix(path, "projects/") && strings.Contains(path, "/assets/")
}

func IsExternalURL(url string) bool {
	if url == "" {
		return false
	}

	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return true
	}

	if strings.HasPrefix(url, "projects/") || strings.HasPrefix(url, "assets/") {
		return false
	}

	return strings.Contains(url, ":")
}

func NormalizeAssetPath(path string) string {
	path = strings.ReplaceAll(path, "\\", "/")
	path = strings.TrimPrefix(path, "/")
	return path
}

func DeduplicateLinks(links []Link) []Link {
	seen := make(map[string]bool)
	unique := []Link{}

	for _, link := range links {
		if !seen[link.URL] {
			seen[link.URL] = true
			unique = append(unique, link)
		}
	}

	return unique
}

func DeduplicateAssets(assets []Asset) []Asset {
	seen := make(map[string]bool)
	unique := []Asset{}

	for _, asset := range assets {
		if !seen[asset.Path] {
			seen[asset.Path] = true
			unique = append(unique, asset)
		}
	}

	return unique
}
