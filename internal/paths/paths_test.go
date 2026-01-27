package paths

import (
	"os"
	"path/filepath"
	"testing"
	"yanta/internal/config"
	"yanta/internal/testenv"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetVaultPath(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	resetConfig()

	err := config.Init()
	require.NoError(t, err)

	t.Run("default vault path", func(t *testing.T) {
		vaultPath := GetVaultPath()
		expectedDefault := filepath.Join(tempDir, ".yanta", "vault")
		assert.Equal(t, expectedDefault, vaultPath)
	})

	t.Run("custom data directory vault path", func(t *testing.T) {
		customDir := filepath.Join(tempDir, "my-git-repo")
		err := config.SetDataDirectory(customDir)
		require.NoError(t, err)

		vaultPath := GetVaultPath()
		expectedPath := filepath.Join(customDir, "vault")
		assert.Equal(t, expectedPath, vaultPath)
	})
}

func TestGetDatabasePath(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	resetConfig()

	err := config.Init()
	require.NoError(t, err)

	t.Run("default database path", func(t *testing.T) {
		dbPath := GetDatabasePath()
		expectedDefault := filepath.Join(tempDir, ".yanta", "yanta.db")
		assert.Equal(t, expectedDefault, dbPath)
	})

	t.Run("custom data directory database path", func(t *testing.T) {
		customDir := filepath.Join(tempDir, "my-git-repo")
		err := config.SetDataDirectory(customDir)
		require.NoError(t, err)

		dbPath := GetDatabasePath()
		expectedPath := filepath.Join(customDir, "yanta.db")
		assert.Equal(t, expectedPath, dbPath)
	})
}

func TestGetLogsPath(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	resetConfig()

	err := config.Init()
	require.NoError(t, err)

	t.Run("logs always in home directory", func(t *testing.T) {
		logsPath := GetLogsPath()
		expectedPath := filepath.Join(tempDir, ".yanta", "logs")
		assert.Equal(t, expectedPath, logsPath)
	})

	t.Run("logs path independent of data directory", func(t *testing.T) {
		customDir := filepath.Join(tempDir, "my-git-repo")
		err := config.SetDataDirectory(customDir)
		require.NoError(t, err)

		logsPath := GetLogsPath()
		expectedPath := filepath.Join(tempDir, ".yanta", "logs")
		assert.Equal(t, expectedPath, logsPath)
	})
}

func TestGetConfigPath(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	t.Run("config always in home directory", func(t *testing.T) {
		configPath := GetConfigPath()
		expectedPath := filepath.Join(tempDir, ".yanta", "config.toml")
		assert.Equal(t, expectedPath, configPath)
	})
}

func resetConfig() {
	config.ResetForTesting()
	os.Setenv("YANTA_LOG_LEVEL", "")
}
