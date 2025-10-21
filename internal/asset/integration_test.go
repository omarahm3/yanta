package asset_test

import (
	"testing"

	"yanta/internal/asset"
	"yanta/internal/vault"
)

func TestVaultImplementsVaultProvider(t *testing.T) {
	v, err := vault.New(vault.Config{RootPath: t.TempDir()})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	var _ asset.VaultProvider = v

	projectAlias := "@test-project"
	assetsPath := v.AssetsPath(projectAlias)
	if assetsPath == "" {
		t.Error("AssetsPath returned empty string")
	}

	err = v.EnsureProjectDir(projectAlias)
	if err != nil {
		t.Errorf("EnsureProjectDir failed: %v", err)
	}
}
