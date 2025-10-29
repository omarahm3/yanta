package vault

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const ProjectMetadataFileName = ".project.json"

type ProjectMetadata struct {
	Alias     string `json:"alias"`
	Name      string `json:"name"`
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func (v *Vault) WriteProjectMetadata(metadata *ProjectMetadata) error {
	if metadata == nil {
		return fmt.Errorf("metadata cannot be nil")
	}

	if metadata.Alias == "" {
		return fmt.Errorf("alias cannot be empty")
	}

	if metadata.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	projectDir := v.ProjectPath(metadata.Alias)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return fmt.Errorf("creating project directory: %w", err)
	}

	metadataPath := filepath.Join(projectDir, ProjectMetadataFileName)
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling metadata: %w", err)
	}

	if err := os.WriteFile(metadataPath, data, 0644); err != nil {
		return fmt.Errorf("writing metadata file: %w", err)
	}

	return nil
}

func (v *Vault) ReadProjectMetadata(alias string) (*ProjectMetadata, error) {
	if alias == "" {
		return nil, fmt.Errorf("alias cannot be empty")
	}

	projectDir := v.ProjectPath(alias)
	metadataPath := filepath.Join(projectDir, ProjectMetadataFileName)

	data, err := os.ReadFile(metadataPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("metadata file not found: %w", err)
		}
		return nil, fmt.Errorf("reading metadata file: %w", err)
	}

	var metadata ProjectMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("parsing metadata file: %w", err)
	}

	if metadata.Alias != alias {
		return nil, fmt.Errorf("alias mismatch: metadata has %s, expected %s", metadata.Alias, alias)
	}

	if metadata.Name == "" {
		return nil, fmt.Errorf("metadata missing required field: name")
	}

	return &metadata, nil
}

func (v *Vault) ProjectMetadataExists(alias string) bool {
	projectDir := v.ProjectPath(alias)
	metadataPath := filepath.Join(projectDir, ProjectMetadataFileName)
	_, err := os.Stat(metadataPath)
	return err == nil
}
