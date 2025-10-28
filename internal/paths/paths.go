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
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta", "logs")
}

func GetConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta", "config.toml")
}
