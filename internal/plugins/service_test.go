package plugins

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
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

	createInstalledPlugin(t, tempDir, "sample.plugin", `id = "sample.plugin"
name = "Sample Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands", "sidebar"]
`)

	svc := NewService()
	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "sample.plugin", list[0].Manifest.ID)
	require.Equal(t, PluginStatusOK, list[0].Status)
	require.Equal(t, IsolationModeLocal, list[0].Isolation)
	require.True(t, list[0].CanExecute)
	require.False(t, list[0].Enabled)

	err = svc.SetPluginEnabled("sample.plugin", true)
	require.NoError(t, err)

	state, err := svc.GetPluginState("sample.plugin")
	require.NoError(t, err)
	require.False(t, state.Enabled)

	list, err = svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.False(t, list[0].Enabled)

	require.NoError(t, svc.SetCommunityPluginsEnabled(true))
	state, err = svc.GetPluginState("sample.plugin")
	require.NoError(t, err)
	require.True(t, state.Enabled)
}

func TestService_ListInstalledReportsManifestErrors(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	createInstalledPlugin(t, tempDir, "broken.plugin", `id = `)

	svc := NewService()
	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "broken.plugin", list[0].Manifest.ID)
	require.Equal(t, PluginStatusInvalidManifest, list[0].Status)
	require.NotEmpty(t, list[0].Issues)
}

func TestService_ListInstalledReportsIncompatibleAPI(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	createInstalledPlugin(t, tempDir, "incompatible.plugin", `id = "incompatible.plugin"
name = "Incompatible Plugin"
version = "1.0.0"
api_version = "2"
entry = "main.js"
capabilities = ["commands"]
`)

	svc := NewService()
	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, PluginStatusIncompatibleAPI, list[0].Status)
	require.NotEmpty(t, list[0].Issues)

	err = svc.SetPluginEnabled("incompatible.plugin", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrNotOperational)
}

func TestService_InstallFromDirectory(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	sourceDir := filepath.Join(tempDir, "source.plugin")
	require.NoError(t, os.MkdirAll(filepath.Join(sourceDir, "nested"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "plugin.toml"), []byte(`id = "install.sample"
name = "Install Sample"
version = "1.0.0"
api_version = "1.0.0"
entry = "main.js"
capabilities = ["commands"]
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "main.js"), []byte("console.log('ok')"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "nested", "readme.txt"), []byte("hello"), 0o644))
	writePluginBuildMetadata(t, sourceDir, nil)

	svc := NewService()
	record, err := svc.InstallFromDirectory(sourceDir)
	require.NoError(t, err)
	require.Equal(t, "install.sample", record.Manifest.ID)
	require.Equal(t, PluginStatusOK, record.Status)
	require.Equal(t, IsolationModeLocal, record.Isolation)
	require.True(t, record.CanExecute)
	require.False(t, record.Enabled)
	require.FileExists(t, filepath.Join(record.Path, "main.js"))
	require.FileExists(t, filepath.Join(record.Path, "nested", "readme.txt"))

	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.False(t, list[0].Enabled)

	_, err = svc.InstallFromDirectory(sourceDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrAlreadyInstalled)
}

func TestService_InstallFromDirectoryValidation(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	svc := NewService()

	badManifestDir := filepath.Join(tempDir, "bad.plugin")
	require.NoError(t, os.MkdirAll(badManifestDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(badManifestDir, "plugin.toml"), []byte(`id = "bad.plugin"`), 0o644))
	_, err := svc.InstallFromDirectory(badManifestDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrInvalidManifest)

	missingEntrypointDir := filepath.Join(tempDir, "missing-entry.plugin")
	require.NoError(t, os.MkdirAll(missingEntrypointDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(missingEntrypointDir, "plugin.toml"), []byte(`id = "missing.entry"
name = "Missing Entry"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = []
`), 0o644))
	_, err = svc.InstallFromDirectory(missingEntrypointDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrInvalidManifest)
	require.Contains(t, err.Error(), "required runtime entry")

	missingMetadataDir := filepath.Join(tempDir, "missing-metadata.plugin")
	require.NoError(t, os.MkdirAll(missingMetadataDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(missingMetadataDir, "plugin.toml"), []byte(`id = "missing.metadata"
name = "Missing Metadata"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = []
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(missingMetadataDir, "main.js"), []byte("console.log('meta')"), 0o644))
	_, err = svc.InstallFromDirectory(missingMetadataDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrBuildMetadataMissing)

	forbiddenBundleDir := filepath.Join(tempDir, "forbidden-bundle.plugin")
	require.NoError(t, os.MkdirAll(forbiddenBundleDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(forbiddenBundleDir, "plugin.toml"), []byte(`id = "forbidden.bundle"
name = "Forbidden Bundle"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = []
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(forbiddenBundleDir, "main.js"), []byte("console.log('forbidden')"), 0o644))
	writePluginBuildMetadata(t, forbiddenBundleDir, []string{"react"})
	_, err = svc.InstallFromDirectory(forbiddenBundleDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrForbiddenBundle)

	hashMismatchDir := filepath.Join(tempDir, "hash-mismatch.plugin")
	require.NoError(t, os.MkdirAll(hashMismatchDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(hashMismatchDir, "plugin.toml"), []byte(`id = "hash.mismatch"
name = "Hash Mismatch"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = []
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(hashMismatchDir, "main.js"), []byte("console.log('hash-1')"), 0o644))
	writePluginBuildMetadata(t, hashMismatchDir, nil)
	require.NoError(t, os.WriteFile(filepath.Join(hashMismatchDir, "main.js"), []byte("console.log('hash-2')"), 0o644))
	_, err = svc.InstallFromDirectory(hashMismatchDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrBuildHashMismatch)

	incompatibleDir := filepath.Join(tempDir, "incompatible.plugin")
	require.NoError(t, os.MkdirAll(incompatibleDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(incompatibleDir, "plugin.toml"), []byte(`id = "new.incompatible"
name = "Incompatible"
version = "1.0.0"
api_version = "2"
entry = "main.js"
capabilities = []
`), 0o644))
	_, err = svc.InstallFromDirectory(incompatibleDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrIncompatibleAPI)
}

func TestService_UninstallRemovesPluginFilesAndState(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	pluginPath := createInstalledPlugin(t, tempDir, "sample.plugin", `id = "sample.plugin"
name = "Sample Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`)
	require.NoError(t, os.WriteFile(filepath.Join(pluginPath, "main.js"), []byte("test"), 0o644))

	require.NoError(t, config.SetPreferencesOverrides(config.PreferencesOverrides{
		Plugins: map[string]config.PreferencesPluginConfig{
			pluginStateNamespace: {
				pluginStateEnabledKey: map[string]any{
					"sample.plugin": true,
					"other.plugin":  true,
				},
			},
			"sample.plugin": {
				"custom": "value",
			},
			"other.plugin": {
				"persist": true,
			},
		},
	}))

	svc := NewService()
	require.NoError(t, svc.Uninstall("sample.plugin"))

	_, err := os.Stat(pluginPath)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))

	overrides := config.GetPreferencesOverrides()
	_, exists := overrides.Plugins["sample.plugin"]
	require.False(t, exists)

	stateConfig := overrides.Plugins[pluginStateNamespace]
	enabledMap := normalizeEnabledMap(stateConfig[pluginStateEnabledKey])
	_, hasSample := enabledMap["sample.plugin"]
	require.False(t, hasSample)
	require.True(t, enabledMap["other.plugin"])
	require.NotNil(t, overrides.Plugins["other.plugin"])
}

func TestService_UninstallUnknownPlugin(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	svc := NewService()
	err := svc.Uninstall("missing.plugin")
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrNotInstalled)
}

func TestService_SetPluginEnabledUnknownPlugin(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	svc := NewService()
	err := svc.SetPluginEnabled("missing.plugin", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrNotInstalled)
}

func TestService_CommunityPluginsMode(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	svc := NewService()
	require.False(t, svc.GetCommunityPluginsEnabled())
	require.NoError(t, svc.SetCommunityPluginsEnabled(true))
	require.True(t, svc.GetCommunityPluginsEnabled())
}

func TestService_ListInstalledDisablesPluginWithMissingBuildMetadata(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	pluginDir := filepath.Join(tempDir, ".yanta", "plugins", "missing.meta")
	require.NoError(t, os.MkdirAll(pluginDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.toml"), []byte(`id = "missing.meta"
name = "Missing Meta"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "main.js"), []byte("console.log('x')"), 0o644))

	svc := NewService()
	list, err := svc.ListInstalled()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.False(t, list[0].CanExecute)
	require.NotEmpty(t, list[0].Issues)
	require.Equal(t, PluginErrBuildMetadataMissing, list[0].Issues[0].Code)
}

func TestService_ReadPluginEntrypointFromSignedPackage(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	svc := NewService()
	require.NoError(
		t,
		svc.AddTrustedPublisherKey("publisher-key-read", "publisher.acme", base64.StdEncoding.EncodeToString(publicKey)),
	)

	packagePath := createSignedPluginPackage(t, tempDir, signedPackageOptions{
		ManifestTOML: `id = "readable.plugin"
name = "Readable Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`,
		PrivateKey:      privateKey,
		KeyID:           "publisher-key-read",
		PublisherID:     "publisher.acme",
		MutateAfterSign: false,
	})

	_, err = svc.InstallFromPackage(packagePath)
	require.NoError(t, err)
	require.NoError(t, svc.SetCommunityPluginsEnabled(true))

	entry, err := svc.ReadPluginEntrypoint("readable.plugin")
	require.NoError(t, err)
	require.Contains(t, entry, "export default {}")
}

func TestService_ReadPluginEntrypointFromLocalPlugin(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	sourceDir := filepath.Join(tempDir, "source.plugin")
	require.NoError(t, os.MkdirAll(sourceDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "plugin.toml"), []byte(`id = "local.read"
name = "Local Read"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "main.js"), []byte("console.log('local')"), 0o644))
	writePluginBuildMetadata(t, sourceDir, nil)

	svc := NewService()
	_, err := svc.InstallFromDirectory(sourceDir)
	require.NoError(t, err)

	entry, err := svc.ReadPluginEntrypoint("local.read")
	require.NoError(t, err)
	require.Contains(t, entry, "console.log('local')")
}

func TestService_InstallFromPackageSigned(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	svc := NewService()
	require.NoError(t, svc.AddTrustedPublisherKey("publisher-key-1", "publisher.acme", base64.StdEncoding.EncodeToString(publicKey)))

	packagePath := createSignedPluginPackage(t, tempDir, signedPackageOptions{
		ManifestTOML: `id = "signed.plugin"
name = "Signed Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`,
		PrivateKey:      privateKey,
		KeyID:           "publisher-key-1",
		PublisherID:     "publisher.acme",
		MutateAfterSign: false,
	})

	record, err := svc.InstallFromPackage(packagePath)
	require.NoError(t, err)
	require.Equal(t, "signed.plugin", record.Manifest.ID)
	require.Equal(t, pluginSourcePackage, record.Source)
	require.Equal(t, IsolationModeSignedPackage, record.Isolation)
	require.True(t, record.CanExecute)
	require.Equal(t, VerificationStatusVerified, record.VerificationStatus)
	require.Equal(t, "publisher.acme", record.PublisherID)
	require.Equal(t, "publisher-key-1", record.SigningKeyID)

	require.NoError(t, svc.SetCommunityPluginsEnabled(true))
	err = svc.SetPluginEnabled("signed.plugin", true)
	require.NoError(t, err)

	state, err := svc.GetPluginState("signed.plugin")
	require.NoError(t, err)
	require.True(t, state.Enabled)
}

func TestService_InstallFromPackageRejectsUntrustedSigner(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	svc := NewService()
	packagePath := createSignedPluginPackage(t, tempDir, signedPackageOptions{
		ManifestTOML: `id = "untrusted.plugin"
name = "Untrusted Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`,
		PrivateKey:      privateKey,
		KeyID:           "untrusted-key",
		PublisherID:     "unknown.publisher",
		MutateAfterSign: false,
	})

	_, err = svc.InstallFromPackage(packagePath)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrUntrustedSigner)
}

func TestService_InstallFromPackageRejectsTamperedPackage(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	config.ResetForTesting()
	require.NoError(t, config.Init())

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	svc := NewService()
	require.NoError(t, svc.AddTrustedPublisherKey("publisher-key-2", "publisher.acme", base64.StdEncoding.EncodeToString(publicKey)))
	packagePath := createSignedPluginPackage(t, tempDir, signedPackageOptions{
		ManifestTOML: `id = "tampered.plugin"
name = "Tampered Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands"]
`,
		PrivateKey:      privateKey,
		KeyID:           "publisher-key-2",
		PublisherID:     "publisher.acme",
		MutateAfterSign: true,
	})

	_, err = svc.InstallFromPackage(packagePath)
	require.Error(t, err)
	require.Contains(t, err.Error(), PluginErrTamperedPackage)
}

type signedPackageOptions struct {
	ManifestTOML    string
	PrivateKey      ed25519.PrivateKey
	KeyID           string
	PublisherID     string
	MutateAfterSign bool
}

func createSignedPluginPackage(t *testing.T, root string, opts signedPackageOptions) string {
	t.Helper()

	sourceDir := filepath.Join(root, "plugin-source-"+opts.KeyID)
	require.NoError(t, os.MkdirAll(sourceDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "plugin.toml"), []byte(opts.ManifestTOML), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "main.js"), []byte("export default {}"), 0o644))
	writePluginBuildMetadata(t, sourceDir, nil)

	digest, err := computePluginDigest(sourceDir)
	require.NoError(t, err)
	digestBytes, err := hex.DecodeString(digest)
	require.NoError(t, err)
	signature := ed25519.Sign(opts.PrivateKey, digestBytes)
	signaturePayload := PackageSignature{
		Algorithm:   signatureAlgorithmEd25519,
		PublisherID: opts.PublisherID,
		KeyID:       opts.KeyID,
		Digest:      digest,
		Signature:   base64.StdEncoding.EncodeToString(signature),
	}
	encodedSignature, err := json.MarshalIndent(signaturePayload, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, packageSignatureFile), encodedSignature, 0o644))

	if opts.MutateAfterSign {
		require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "main.js"), []byte("export const tampered = true"), 0o644))
		writePluginBuildMetadata(t, sourceDir, nil)
	}

	packagePath := filepath.Join(root, "plugin-"+opts.KeyID+".yplg")
	writeZipFromDir(t, sourceDir, packagePath)
	return packagePath
}

func writeZipFromDir(t *testing.T, sourceDir string, outputPath string) {
	t.Helper()

	out, err := os.Create(outputPath)
	require.NoError(t, err)
	defer out.Close()

	zipWriter := zip.NewWriter(out)
	defer zipWriter.Close()

	err = filepath.Walk(sourceDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = rel
		header.Method = zip.Deflate
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		_, err = writer.Write(data)
		return err
	})
	require.NoError(t, err)
	require.NoError(t, zipWriter.Close())
}

func createInstalledPlugin(t *testing.T, homeDir, folderName, manifest string) string {
	t.Helper()
	pluginDir := filepath.Join(homeDir, ".yanta", "plugins", folderName)
	require.NoError(t, os.MkdirAll(pluginDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.toml"), []byte(manifest), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "main.js"), []byte("console.log('installed')"), 0o644))
	writePluginBuildMetadata(t, pluginDir, nil)
	return pluginDir
}

func writePluginBuildMetadata(t *testing.T, pluginDir string, bundledPackages []string) {
	t.Helper()
	entryPath := filepath.Join(pluginDir, "main.js")
	entryData, err := os.ReadFile(entryPath)
	require.NoError(t, err)
	sum := sha256.Sum256(entryData)

	meta := PluginBuildMetadata{
		Builder:                 pluginBuildMetadataBuilder,
		BuilderVersion:          "test",
		BuildTool:               pluginBuildMetadataTool,
		Format:                  pluginBuildMetadataFormat,
		HostExternals:           append([]string(nil), forbiddenBundledRuntimePackages...),
		DetectedBundledPackages: append([]string(nil), bundledPackages...),
		EntryHashSHA256:         hex.EncodeToString(sum[:]),
		GeneratedAt:             "2026-01-01T00:00:00Z",
	}
	encoded, err := json.MarshalIndent(meta, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(pluginDir, requiredPluginBuildMetadataFile), encoded, 0o644))
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
