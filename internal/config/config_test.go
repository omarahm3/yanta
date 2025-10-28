package config

import (
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfig_GitSync(t *testing.T) {
	tempDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHome)
	os.Setenv("HOME", tempDir)

	instance = nil
	instanceOnce = newOnce()

	err := Init()
	require.NoError(t, err)

	t.Run("default git sync config", func(t *testing.T) {
		cfg := Get()
		assert.NotNil(t, cfg)
		assert.False(t, cfg.GitSync.Enabled)
		assert.Empty(t, cfg.GitSync.RepositoryPath)
		assert.Empty(t, cfg.GitSync.RemoteURL)
		assert.False(t, cfg.GitSync.AutoCommit)
		assert.False(t, cfg.GitSync.AutoPush)
	})

	t.Run("set git sync config", func(t *testing.T) {
		gitCfg := GitSyncConfig{
			Enabled:        true,
			RepositoryPath: "/path/to/repo",
			RemoteURL:      "https://github.com/user/repo.git",
			AutoCommit:     true,
			AutoPush:       false,
		}

		err := SetGitSyncConfig(gitCfg)
		require.NoError(t, err)

		cfg := GetGitSyncConfig()
		assert.True(t, cfg.Enabled)
		assert.Equal(t, "/path/to/repo", cfg.RepositoryPath)
		assert.Equal(t, "https://github.com/user/repo.git", cfg.RemoteURL)
		assert.True(t, cfg.AutoCommit)
		assert.False(t, cfg.AutoPush)
	})

	t.Run("persist git sync config", func(t *testing.T) {
		instance = nil
		instanceOnce = newOnce()

		err := Init()
		require.NoError(t, err)

		cfg := GetGitSyncConfig()
		assert.True(t, cfg.Enabled)
		assert.Equal(t, "/path/to/repo", cfg.RepositoryPath)
	})
}

func TestConfig_DataDirectory(t *testing.T) {
	tempDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHome)
	os.Setenv("HOME", tempDir)

	instance = nil
	instanceOnce = newOnce()

	err := Init()
	require.NoError(t, err)

	t.Run("default data directory", func(t *testing.T) {
		dataDir := GetDataDirectory()
		expectedDefault := filepath.Join(tempDir, ".yanta")
		assert.Equal(t, expectedDefault, dataDir)
	})

	t.Run("set custom data directory", func(t *testing.T) {
		customDir := filepath.Join(tempDir, "custom-yanta")
		err := SetDataDirectory(customDir)
		require.NoError(t, err)

		dataDir := GetDataDirectory()
		assert.Equal(t, customDir, dataDir)
	})

	t.Run("persist data directory", func(t *testing.T) {
		instance = nil
		instanceOnce = newOnce()

		err := Init()
		require.NoError(t, err)

		dataDir := GetDataDirectory()
		customDir := filepath.Join(tempDir, "custom-yanta")
		assert.Equal(t, customDir, dataDir)
	})
}

func TestConfig_ExistingFields(t *testing.T) {
	tempDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	defer os.Setenv("HOME", oldHome)
	os.Setenv("HOME", tempDir)

	instance = nil
	instanceOnce = newOnce()

	err := Init()
	require.NoError(t, err)

	t.Run("log level", func(t *testing.T) {
		err := SetLogLevel("debug")
		require.NoError(t, err)

		level := GetLogLevel()
		assert.Equal(t, "debug", level)
	})

	t.Run("invalid log level", func(t *testing.T) {
		err := SetLogLevel("invalid")
		assert.Error(t, err)
	})
}

func newOnce() sync.Once {
	return sync.Once{}
}
