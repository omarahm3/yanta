package config

import (
	"path/filepath"
	"sync"
	"testing"
	"yanta/internal/testenv"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfig_GitSync(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	instance = nil
	instanceOnce = newOnce()

	err := Init()
	require.NoError(t, err)

	t.Run("default git sync config", func(t *testing.T) {
		cfg := Get()
		assert.NotNil(t, cfg)
		assert.False(t, cfg.GitSync.Enabled)
		assert.False(t, cfg.GitSync.AutoCommit)
		assert.False(t, cfg.GitSync.AutoPush)
	})

	t.Run("set git sync config", func(t *testing.T) {
		gitCfg := GitSyncConfig{
			Enabled:    true,
			AutoCommit: true,
			AutoPush:   false,
		}

		err := SetGitSyncConfig(gitCfg)
		require.NoError(t, err)

		cfg := GetGitSyncConfig()
		assert.True(t, cfg.Enabled)
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
		assert.True(t, cfg.AutoCommit)
	})

	t.Run("commit interval zero means manual-only mode", func(t *testing.T) {
		// When CommitInterval is 0, it means manual-only mode (no auto-commits)
		// This should be preserved, not overridden to a default
		gitCfg := GitSyncConfig{
			Enabled:        true,
			AutoCommit:     true,
			CommitInterval: 0, // Manual only
		}

		err := SetGitSyncConfig(gitCfg)
		require.NoError(t, err)

		cfg := GetGitSyncConfig()
		assert.Equal(t, 0, cfg.CommitInterval, "CommitInterval=0 should be preserved for manual-only mode")
	})

	t.Run("commit interval is preserved when set", func(t *testing.T) {
		gitCfg := GitSyncConfig{
			Enabled:        true,
			AutoCommit:     true,
			CommitInterval: 30, // 30 minutes
		}

		err := SetGitSyncConfig(gitCfg)
		require.NoError(t, err)

		cfg := GetGitSyncConfig()
		assert.Equal(t, 30, cfg.CommitInterval)
	})
}

func TestConfig_DataDirectory(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

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
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

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
