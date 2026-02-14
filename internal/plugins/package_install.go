package plugins

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/BurntSushi/toml"
)

func (s *Service) InstallFromPackage(sourcePath string) (InstallRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmedPath := strings.TrimSpace(sourcePath)
	if trimmedPath == "" {
		return InstallRecord{}, pluginError(PluginErrBadSource, "package path is required")
	}
	info, err := os.Stat(trimmedPath)
	if err != nil {
		return InstallRecord{}, pluginError(PluginErrBadSource, fmt.Sprintf("package path not accessible: %v", err))
	}
	if info.IsDir() {
		return InstallRecord{}, pluginError(PluginErrBadSource, "package path must be a file")
	}

	extractDir, err := os.MkdirTemp("", "yanta-plugin-package-*")
	if err != nil {
		return InstallRecord{}, fmt.Errorf("create package extraction directory: %w", err)
	}
	defer os.RemoveAll(extractDir)

	if err := unzipPluginPackage(trimmedPath, extractDir); err != nil {
		return InstallRecord{}, pluginError(PluginErrBadSource, fmt.Sprintf("failed to unpack package: %v", err))
	}

	manifestPath := filepath.Join(extractDir, "plugin.toml")
	var manifest Manifest
	_, decodeErr := toml.DecodeFile(manifestPath, &manifest)
	status, issues := validateManifest(manifest, decodeErr)
	if status == PluginStatusInvalidManifest {
		return InstallRecord{}, pluginError(PluginErrInvalidManifest, summarizeIssues(issues))
	}
	if status == PluginStatusIncompatibleAPI {
		return InstallRecord{}, pluginError(PluginErrIncompatibleAPI, summarizeIssues(issues))
	}

	if strings.TrimSpace(manifest.Entry) != "" {
		entry := filepath.Join(extractDir, filepath.Clean(manifest.Entry))
		if !strings.HasPrefix(entry, extractDir+string(os.PathSeparator)) && entry != extractDir {
			return InstallRecord{}, pluginError(PluginErrInvalidManifest, "entry path escapes package root")
		}
		if _, err := os.Stat(entry); err != nil {
			return InstallRecord{}, pluginError(PluginErrInvalidManifest, fmt.Sprintf("entry file %q does not exist in package", manifest.Entry))
		}
	}

	keys, err := s.loadTrustedKeys()
	if err != nil {
		return InstallRecord{}, err
	}
	metadata, err := verifyPackageSignature(extractDir, keys)
	if err != nil {
		return InstallRecord{}, err
	}

	root, err := s.pluginDir()
	if err != nil {
		return InstallRecord{}, err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return InstallRecord{}, fmt.Errorf("create plugin directory %s: %w", root, err)
	}
	destPath := filepath.Join(root, manifest.ID)
	if _, err := os.Stat(destPath); err == nil {
		return InstallRecord{}, pluginError(PluginErrAlreadyInstalled, fmt.Sprintf("plugin %q is already installed", manifest.ID))
	} else if !os.IsNotExist(err) {
		return InstallRecord{}, fmt.Errorf("stat destination %s: %w", destPath, err)
	}

	if err := copyDirectory(extractDir, destPath); err != nil {
		_ = os.RemoveAll(destPath)
		return InstallRecord{}, fmt.Errorf("copy plugin files: %w", err)
	}
	if err := persistInstallMetadata(filepath.Join(destPath, installMetadataFile), metadata); err != nil {
		_ = os.RemoveAll(destPath)
		return InstallRecord{}, fmt.Errorf("persist install metadata: %w", err)
	}
	if err := persistEnabledState(manifest.ID, false); err != nil {
		_ = os.RemoveAll(destPath)
		return InstallRecord{}, err
	}

	return InstallRecord{
		Manifest:           manifest,
		Path:               destPath,
		Source:             metadata.Source,
		Enabled:            false,
		Status:             PluginStatusOK,
		Isolation:          metadata.Isolation,
		CanExecute:         metadata.CanExecute,
		VerificationStatus: metadata.VerificationStatus,
		PublisherID:        metadata.PublisherID,
		SigningKeyID:       metadata.SigningKeyID,
	}, nil
}
