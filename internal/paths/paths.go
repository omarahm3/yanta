// Package paths provides path resolution and manipulation utilities.
package paths

import (
	"path/filepath"
	"yanta/internal/config"
)

func GetVaultPath() string {
	return filepath.Join(config.GetDataDirectory(), "vault")
}

func GetDatabasePath() string {
	return filepath.Join(config.GetDataDirectory(), "yanta.db")
}

func GetLogsPath() string {
	return filepath.Join(config.GetAppRootDirectory(), "logs")
}

func GetConfigPath() string {
	return filepath.Join(config.GetAppRootDirectory(), "config.toml")
}

func GetBackupsPath() string {
	return filepath.Join(config.GetDataDirectory(), "backups")
}
