package plugins

import (
	"archive/zip"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const packageSignatureFile = "signature.json"
const signatureAlgorithmEd25519 = "ed25519"

type PackageSignature struct {
	Algorithm   string `json:"algorithm"`
	PublisherID string `json:"publisherId"`
	KeyID       string `json:"keyId"`
	Digest      string `json:"digest"`
	Signature   string `json:"signature"`
}

type TrustedPublisherKey struct {
	KeyID       string `json:"keyId"`
	PublisherID string `json:"publisherId"`
	Algorithm   string `json:"algorithm"`
	PublicKey   string `json:"publicKey"`
	AddedAt     string `json:"addedAt"`
}

func (s *Service) trustedKeysPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".yanta", "plugins", "trusted_keys.json"), nil
}

func (s *Service) loadTrustedKeys() (map[string]TrustedPublisherKey, error) {
	path, err := s.trustedKeysPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return map[string]TrustedPublisherKey{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read trusted keys: %w", err)
	}
	var keys map[string]TrustedPublisherKey
	if err := json.Unmarshal(data, &keys); err != nil {
		return nil, fmt.Errorf("decode trusted keys: %w", err)
	}
	if keys == nil {
		return map[string]TrustedPublisherKey{}, nil
	}
	return keys, nil
}

func (s *Service) persistTrustedKeys(keys map[string]TrustedPublisherKey) error {
	path, err := s.trustedKeysPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create trusted key directory: %w", err)
	}
	encoded, err := json.MarshalIndent(keys, "", "  ")
	if err != nil {
		return fmt.Errorf("encode trusted keys: %w", err)
	}
	if err := os.WriteFile(path, encoded, 0o644); err != nil {
		return fmt.Errorf("write trusted keys: %w", err)
	}
	return nil
}

func (s *Service) ListTrustedPublisherKeys() ([]TrustedPublisherKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys, err := s.loadTrustedKeys()
	if err != nil {
		return nil, err
	}
	out := make([]TrustedPublisherKey, 0, len(keys))
	for _, key := range keys {
		out = append(out, key)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].KeyID < out[j].KeyID
	})
	return out, nil
}

func (s *Service) AddTrustedPublisherKey(
	keyID string,
	publisherID string,
	publicKey string,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmedKeyID := strings.TrimSpace(keyID)
	trimmedPublisher := strings.TrimSpace(publisherID)
	trimmedPublic := strings.TrimSpace(publicKey)
	if trimmedKeyID == "" || trimmedPublisher == "" || trimmedPublic == "" {
		return pluginError(PluginErrBadSource, "keyId, publisherId, and publicKey are required")
	}
	decoded, err := base64.StdEncoding.DecodeString(trimmedPublic)
	if err != nil {
		return pluginError(PluginErrBadSource, fmt.Sprintf("invalid public key encoding: %v", err))
	}
	if len(decoded) != ed25519.PublicKeySize {
		return pluginError(PluginErrBadSource, "public key must be 32-byte ed25519 key encoded in base64")
	}

	keys, err := s.loadTrustedKeys()
	if err != nil {
		return err
	}
	keys[trimmedKeyID] = TrustedPublisherKey{
		KeyID:       trimmedKeyID,
		PublisherID: trimmedPublisher,
		Algorithm:   signatureAlgorithmEd25519,
		PublicKey:   trimmedPublic,
		AddedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	return s.persistTrustedKeys(keys)
}

func (s *Service) RemoveTrustedPublisherKey(keyID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmed := strings.TrimSpace(keyID)
	if trimmed == "" {
		return pluginError(PluginErrBadSource, "keyId is required")
	}
	keys, err := s.loadTrustedKeys()
	if err != nil {
		return err
	}
	delete(keys, trimmed)
	return s.persistTrustedKeys(keys)
}

func computePluginDigest(root string) (string, error) {
	files := make([]string, 0, 32)
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if rel == packageSignatureFile {
			return nil
		}
		files = append(files, rel)
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("walk plugin files for digest: %w", err)
	}

	sort.Strings(files)
	hash := sha256.New()
	for _, rel := range files {
		hash.Write([]byte(rel))
		hash.Write([]byte{0})
		content, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			return "", fmt.Errorf("read %s for digest: %w", rel, err)
		}
		hash.Write(content)
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func readPackageSignature(path string) (PackageSignature, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return PackageSignature{}, err
	}
	var sig PackageSignature
	if err := json.Unmarshal(data, &sig); err != nil {
		return PackageSignature{}, err
	}
	return sig, nil
}

func verifyPackageSignature(root string, keys map[string]TrustedPublisherKey) (InstallMetadata, error) {
	sigPath := filepath.Join(root, packageSignatureFile)
	if _, err := os.Stat(sigPath); err != nil {
		if os.IsNotExist(err) {
			return InstallMetadata{}, pluginError(PluginErrUnsignedPackage, "missing signature.json")
		}
		return InstallMetadata{}, fmt.Errorf("stat signature file: %w", err)
	}

	sig, err := readPackageSignature(sigPath)
	if err != nil {
		return InstallMetadata{}, pluginError(PluginErrInvalidSignature, fmt.Sprintf("invalid signature.json: %v", err))
	}
	if strings.TrimSpace(sig.Algorithm) != signatureAlgorithmEd25519 {
		return InstallMetadata{}, pluginError(PluginErrInvalidSignature, "unsupported signature algorithm")
	}
	if strings.TrimSpace(sig.KeyID) == "" || strings.TrimSpace(sig.PublisherID) == "" {
		return InstallMetadata{}, pluginError(PluginErrInvalidSignature, "signature keyId and publisherId are required")
	}

	digest, err := computePluginDigest(root)
	if err != nil {
		return InstallMetadata{}, err
	}
	if !strings.EqualFold(strings.TrimSpace(sig.Digest), digest) {
		return InstallMetadata{}, pluginError(PluginErrTamperedPackage, "digest mismatch")
	}

	trusted, ok := keys[sig.KeyID]
	if !ok {
		return InstallMetadata{}, pluginError(PluginErrUntrustedSigner, fmt.Sprintf("untrusted signer key %q", sig.KeyID))
	}
	if trusted.Algorithm != signatureAlgorithmEd25519 {
		return InstallMetadata{}, pluginError(PluginErrUntrustedSigner, "trusted key algorithm is not ed25519")
	}
	if trusted.PublisherID != sig.PublisherID {
		return InstallMetadata{}, pluginError(PluginErrUntrustedSigner, "signature publisher does not match trusted key owner")
	}

	publicKeyBytes, err := base64.StdEncoding.DecodeString(trusted.PublicKey)
	if err != nil || len(publicKeyBytes) != ed25519.PublicKeySize {
		return InstallMetadata{}, pluginError(PluginErrUntrustedSigner, "trusted key is invalid")
	}
	signatureBytes, err := base64.StdEncoding.DecodeString(sig.Signature)
	if err != nil || len(signatureBytes) != ed25519.SignatureSize {
		return InstallMetadata{}, pluginError(PluginErrInvalidSignature, "signature payload is invalid")
	}
	digestBytes, err := hex.DecodeString(digest)
	if err != nil {
		return InstallMetadata{}, pluginError(PluginErrTamperedPackage, "digest format is invalid")
	}
	if !ed25519.Verify(ed25519.PublicKey(publicKeyBytes), digestBytes, signatureBytes) {
		return InstallMetadata{}, pluginError(PluginErrInvalidSignature, "signature verification failed")
	}

	return InstallMetadata{
		Source:             pluginSourcePackage,
		Isolation:          IsolationModeSignedPackage,
		CanExecute:         true,
		VerificationStatus: VerificationStatusVerified,
		PublisherID:        trusted.PublisherID,
		SigningKeyID:       sig.KeyID,
	}, nil
}

func unzipPluginPackage(sourcePath string, destPath string) error {
	archive, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open package: %w", err)
	}
	defer archive.Close()

	stat, err := archive.Stat()
	if err != nil {
		return fmt.Errorf("stat package: %w", err)
	}

	zipReader, err := zip.NewReader(archive, stat.Size())
	if err != nil {
		return fmt.Errorf("open zip package: %w", err)
	}

	for _, file := range zipReader.File {
		rel := filepath.Clean(file.Name)
		if rel == "." {
			continue
		}
		target := filepath.Join(destPath, rel)
		if !strings.HasPrefix(target, destPath+string(os.PathSeparator)) && target != destPath {
			return fmt.Errorf("package contains invalid path: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(target, file.Mode()); err != nil {
				return fmt.Errorf("create directory %s: %w", target, err)
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("create parent directory %s: %w", target, err)
		}
		src, err := file.Open()
		if err != nil {
			return fmt.Errorf("open package file %s: %w", file.Name, err)
		}
		dst, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, file.Mode())
		if err != nil {
			src.Close()
			return fmt.Errorf("create extracted file %s: %w", target, err)
		}
		if _, err := io.Copy(dst, src); err != nil {
			dst.Close()
			src.Close()
			return fmt.Errorf("extract file %s: %w", file.Name, err)
		}
		dst.Close()
		src.Close()
	}
	return nil
}
