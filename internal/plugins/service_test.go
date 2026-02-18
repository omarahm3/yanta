package plugins

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"yanta/internal/config"
	"yanta/internal/testenv"
)

func TestService_ListInstalledAndState(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	pluginDir := filepath.Join(tempDir, ".yanta", "plugins", "sample.plugin")
	require.NoError(t, os.MkdirAll(pluginDir, 0o755))
	manifest := `id = "sample.plugin"
name = "Sample Plugin"
version = "1.0.0"
api_version = "1"
entry = "index.js"
capabilities = ["commands", "sidebar"]
`
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.toml"), []byte(manifest), 0o644))

	svc := NewService()
	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "sample.plugin", list[0].Manifest.ID)
	require.False(t, list[0].Enabled)

	require.NoError(t, svc.SetPluginEnabled("sample.plugin", true))

	state, err := svc.GetPluginState("sample.plugin")
	require.NoError(t, err)
	require.True(t, state.Enabled)

	list, err = svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.True(t, list[0].Enabled)
}

func TestService_PluginDirectoryFollowsAppRoot(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	appRoot := filepath.Join(tempDir, "isolated-home")
	cleanupAppRoot := testenv.SetTestAppHome(t, appRoot)
	defer cleanupAppRoot()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	svc := NewService()
	dir, err := svc.GetPluginDirectory()
	require.NoError(t, err)
	require.Equal(t, filepath.Join(appRoot, "plugins"), dir)
}
