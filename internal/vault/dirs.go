package vault

import (
	"fmt"
	"os"
	"path/filepath"
	"yanta/internal/project"
)

func (v *Vault) EnsureProjectDir(projectAlias string) error {
	if err := project.ValidateAlias(projectAlias); err != nil {
		return err
	}

	projectDir := v.ProjectPath(projectAlias)

	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return fmt.Errorf("creating project directory: %w", err)
	}

	assetsDir := v.AssetsPath(projectAlias)
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		return fmt.Errorf("creating assets directory: %w", err)
	}

	return nil
}

func (v *Vault) ProjectExists(projectAlias string) (bool, error) {
	if err := project.ValidateAlias(projectAlias); err != nil {
		return false, err
	}

	projectDir := v.ProjectPath(projectAlias)

	info, err := os.Stat(projectDir)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("checking project directory: %w", err)
	}

	if !info.IsDir() {
		return false, fmt.Errorf("project path exists but is not a directory: %s", projectDir)
	}

	return true, nil
}

func (v *Vault) ListProjects() ([]string, error) {
	projectsDir := filepath.Join(v.rootPath, "projects")

	entries, err := os.ReadDir(projectsDir)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading projects directory: %w", err)
	}

	var aliases []string
	for _, entry := range entries {
		if entry.IsDir() {
			aliases = append(aliases, entry.Name())
		}
	}

	return aliases, nil
}

func (v *Vault) DeleteProjectDir(projectAlias string) error {
	if err := project.ValidateAlias(projectAlias); err != nil {
		return err
	}

	projectDir := v.ProjectPath(projectAlias)

	exists, err := v.ProjectExists(projectAlias)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("project directory does not exist: %s", projectAlias)
	}

	if err := os.RemoveAll(projectDir); err != nil {
		return fmt.Errorf("deleting project directory: %w", err)
	}

	return nil
}

func (v *Vault) RenameProject(oldAlias, newAlias string) error {
	if err := project.ValidateAlias(oldAlias); err != nil {
		return fmt.Errorf("invalid old alias: %w", err)
	}
	if err := project.ValidateAlias(newAlias); err != nil {
		return fmt.Errorf("invalid new alias: %w", err)
	}

	oldPath := v.ProjectPath(oldAlias)
	newPath := v.ProjectPath(newAlias)

	exists, err := v.ProjectExists(oldAlias)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("source project does not exist: %s", oldAlias)
	}

	exists, err = v.ProjectExists(newAlias)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("destination project already exists: %s", newAlias)
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("renaming project directory: %w", err)
	}

	return nil
}
