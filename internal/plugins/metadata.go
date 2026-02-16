package plugins

import (
	"encoding/json"
	"os"
)

func loadInstallMetadata(path string) *InstallMetadata {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var meta InstallMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil
	}
	return &meta
}

func persistInstallMetadata(path string, meta InstallMetadata) error {
	encoded, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, encoded, 0o644)
}
