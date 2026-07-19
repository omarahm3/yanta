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

	// Content-addressed dedup: an existing file with the same hash already holds
	// identical bytes — UNLESS a previous write was torn (crash/ENOSPC mid-write).
	// Verify the on-disk content still hashes to `hash`; if not, treat it as
	// absent and rewrite, so a corrupt file self-heals instead of poisoning every
	// future read (ReadAsset's hash check would otherwise fail forever).
	alreadyExists := false
	if existing, err := os.ReadFile(filePath); err == nil {
		if ComputeHash(existing) == hash {
			alreadyExists = true
		}
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("checking existing asset: %w", err)
	}

	if !alreadyExists {
		if err := writeFileAtomic(filePath, data, 0644); err != nil {
			// Content addressing makes concurrent writers of the SAME hash race for
			// the same destination; on Windows the losing rename can fail with
			// "Access denied" while the winner's identical bytes land correctly. If
			// the file is now present and hashes right, that's a success, not a
			// failure — swallow the rename error.
			if existing, rerr := os.ReadFile(filePath); rerr == nil && ComputeHash(existing) == hash {
				alreadyExists = true
			} else {
				return nil, fmt.Errorf("writing asset file: %w", err)
			}
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

// writeFileAtomic writes data to a temp file in the same directory then renames
// it into place, so a reader never observes a partially-written asset and a
// crash mid-write can't leave a truncated file that dedup would later trust.
func writeFileAtomic(filePath string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(filePath)
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}
	tmpPath := tmp.Name()
	// Best-effort cleanup if we bail before the rename.
	defer func() { _ = os.Remove(tmpPath) }()

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("writing temp file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("syncing temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("closing temp file: %w", err)
	}
	if err := os.Chmod(tmpPath, perm); err != nil {
		return fmt.Errorf("chmod temp file: %w", err)
	}
	if err := os.Rename(tmpPath, filePath); err != nil {
		return fmt.Errorf("renaming temp file into place: %w", err)
	}
	return nil
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
