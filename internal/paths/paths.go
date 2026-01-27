package paths

import (
	"os"
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
	// If YANTA_DATA_DIR is set, logs should follow it for complete isolation
	if os.Getenv("YANTA_DATA_DIR") != "" {
		return filepath.Join(config.GetDataDirectory(), "logs")
	}
	// Otherwise, keep logs in home directory
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta", "logs")
}

func GetConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta", "config.toml")
}
