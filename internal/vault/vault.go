package vault

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"yanta/internal/paths"
)

type Vault struct {
	rootPath string
}

type Config struct {
	RootPath string
}

func DefaultRootPath() (string, error) {
	return paths.GetVaultPath(), nil
}

func New(cfg Config) (*Vault, error) {
	rootPath := cfg.RootPath

	if rootPath == "" {
		var err error
		rootPath, err = DefaultRootPath()
		if err != nil {
			return nil, err
		}
	}

	absPath, err := filepath.Abs(rootPath)
	if err != nil {
		return nil, fmt.Errorf("resolving absolute path: %w", err)
	}

	if err := validateRootPath(absPath); err != nil {
		return nil, err
	}

	v := &Vault{
		rootPath: absPath,
	}

	if err := v.ensureRootExists(); err != nil {
		return nil, err
	}

	return v, nil
}

func (v *Vault) RootPath() string {
	return v.rootPath
}

func (v *Vault) ProjectPath(projectAlias string) string {
	return filepath.Join(v.rootPath, "projects", projectAlias)
}

func (v *Vault) AssetsPath(projectAlias string) string {
	return filepath.Join(v.ProjectPath(projectAlias), "assets")
}

func (v *Vault) DocumentPath(relativePath string) (string, error) {
	relativePath = NormalizeDocumentPath(relativePath)
	if err := ValidateDocumentPath(relativePath); err != nil {
		return "", err
	}

	return filepath.Join(v.rootPath, relativePath), nil
}

func (v *Vault) RelativePath(absolutePath string) (string, error) {
	rel, err := filepath.Rel(v.rootPath, absolutePath)
	if err != nil {
		return "", fmt.Errorf("computing relative path: %w", err)
	}

	if filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes vault: %s", absolutePath)
	}

	return filepath.ToSlash(rel), nil
}

func (v *Vault) ensureRootExists() error {
	if err := os.MkdirAll(v.rootPath, 0755); err != nil {
		return fmt.Errorf("creating vault root: %w", err)
	}

	projectsDir := filepath.Join(v.rootPath, "projects")
	if err := os.MkdirAll(projectsDir, 0755); err != nil {
		return fmt.Errorf("creating projects directory: %w", err)
	}

	return nil
}

func validateRootPath(path string) error {
	if path == "" {
		return fmt.Errorf("vault root path cannot be empty")
	}

	if !filepath.IsAbs(path) {
		return fmt.Errorf("vault root must be absolute path, got: %s", path)
	}

	if path == "/" || path == filepath.VolumeName(path)+string(filepath.Separator) {
		return fmt.Errorf("vault root cannot be filesystem root")
	}

	return nil
}
