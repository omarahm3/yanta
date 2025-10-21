package asset

import (
	"fmt"
	"os"
	"path/filepath"
)

type VaultProvider interface {
	AssetsPath(projectAlias string) string
	EnsureProjectDir(projectAlias string) error
}

func WriteAsset(vault VaultProvider, projectAlias string, data []byte, ext string) (*AssetInfo, error) {
	if vault == nil {
		return nil, fmt.Errorf("vault cannot be nil")
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("data cannot be empty")
	}

	ext = NormalizeExtension(ext)

	if err := ValidateExtension(ext); err != nil {
		return nil, fmt.Errorf("invalid extension: %w", err)
	}

	hash := ComputeHash(data)

	mime := DetectMIME(ext)

	if err := vault.EnsureProjectDir(projectAlias); err != nil {
		return nil, fmt.Errorf("ensuring project directory: %w", err)
	}

	assetsDir := vault.AssetsPath(projectAlias)
	filename := hash + ext
	filePath := filepath.Join(assetsDir, filename)

	alreadyExists := false
	if _, err := os.Stat(filePath); err == nil {
		alreadyExists = true
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("checking file existence: %w", err)
	}

	if !alreadyExists {
		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return nil, fmt.Errorf("writing asset file: %w", err)
		}
	}

	return &AssetInfo{
		Hash:         hash,
		Ext:          ext,
		Bytes:        int64(len(data)),
		MIME:         mime,
		AlreadyExist: alreadyExists,
	}, nil
}

func ReadAsset(vault VaultProvider, projectAlias, hash, ext string) ([]byte, error) {
	if vault == nil {
		return nil, fmt.Errorf("vault cannot be nil")
	}

	if err := ValidateHash(hash); err != nil {
		return nil, fmt.Errorf("invalid hash: %w", err)
	}

	ext = NormalizeExtension(ext)

	if err := ValidateExtension(ext); err != nil {
		return nil, fmt.Errorf("invalid extension: %w", err)
	}

	assetsDir := vault.AssetsPath(projectAlias)
	filename := hash + ext
	filePath := filepath.Join(assetsDir, filename)

	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("asset not found: %s%s", hash, ext)
	}
	if err != nil {
		return nil, fmt.Errorf("reading asset file: %w", err)
	}

	actualHash := ComputeHash(data)
	if actualHash != hash {
		return nil, fmt.Errorf("hash mismatch: expected %s, got %s", hash, actualHash)
	}

	return data, nil
}

func DeleteAsset(vault VaultProvider, projectAlias, hash, ext string) error {
	if vault == nil {
		return fmt.Errorf("vault cannot be nil")
	}

	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	ext = NormalizeExtension(ext)

	if err := ValidateExtension(ext); err != nil {
		return fmt.Errorf("invalid extension: %w", err)
	}

	assetsDir := vault.AssetsPath(projectAlias)
	filename := hash + ext
	filePath := filepath.Join(assetsDir, filename)

	err := os.Remove(filePath)
	if os.IsNotExist(err) {
		return fmt.Errorf("asset not found: %s%s", hash, ext)
	}
	if err != nil {
		return fmt.Errorf("deleting asset file: %w", err)
	}

	return nil
}

func AssetExists(vault VaultProvider, projectAlias, hash, ext string) (bool, error) {
	if vault == nil {
		return false, fmt.Errorf("vault cannot be nil")
	}

	if err := ValidateHash(hash); err != nil {
		return false, fmt.Errorf("invalid hash: %w", err)
	}

	ext = NormalizeExtension(ext)

	if err := ValidateExtension(ext); err != nil {
		return false, fmt.Errorf("invalid extension: %w", err)
	}

	assetsDir := vault.AssetsPath(projectAlias)
	filename := hash + ext
	filePath := filepath.Join(assetsDir, filename)

	_, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("checking asset existence: %w", err)
	}

	return true, nil
}
