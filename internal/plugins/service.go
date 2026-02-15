package plugins

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"

	"yanta/internal/config"
)

const pluginStateNamespace = "__plugin_state"
const pluginStateEnabledKey = "enabled"
const pluginStateCommunityEnabledKey = "community_enabled"
const pluginSourceLocal = "local"
const pluginSourcePackage = "package"
const installMetadataFile = ".yanta-install.json"
const requiredPluginEntrypoint = "main.js"
const requiredPluginBuildMetadataFile = "main.meta.json"

const (
	PluginErrInvalidManifest      = "PLUGIN_INVALID_MANIFEST"
	PluginErrIncompatibleAPI      = "PLUGIN_INCOMPATIBLE_API"
	PluginErrAlreadyInstalled     = "PLUGIN_ALREADY_INSTALLED"
	PluginErrNotInstalled         = "PLUGIN_NOT_INSTALLED"
	PluginErrNotOperational       = "PLUGIN_NOT_OPERATIONAL"
	PluginErrSandboxRestricted    = "PLUGIN_SANDBOX_RESTRICTED"
	PluginErrBadSource            = "PLUGIN_BAD_SOURCE"
	PluginErrUnsignedPackage      = "PLUGIN_UNSIGNED_PACKAGE"
	PluginErrTamperedPackage      = "PLUGIN_TAMPERED_PACKAGE"
	PluginErrInvalidSignature     = "PLUGIN_INVALID_SIGNATURE"
	PluginErrUntrustedSigner      = "PLUGIN_UNTRUSTED_SIGNER"
	PluginErrBuildMetadataMissing = "PLUGIN_BUILD_METADATA_MISSING"
	PluginErrBuildMetadataInvalid = "PLUGIN_BUILD_METADATA_INVALID"
	PluginErrBuildHashMismatch    = "PLUGIN_BUILD_HASH_MISMATCH"
	PluginErrForbiddenBundle      = "PLUGIN_FORBIDDEN_BUNDLE"
)

type PluginStatus string

const (
	PluginStatusOK              PluginStatus = "ok"
	PluginStatusInvalidManifest PluginStatus = "invalid_manifest"
	PluginStatusIncompatibleAPI PluginStatus = "incompatible_api"
)

type IsolationMode string

const (
	IsolationModeLocal            IsolationMode = "local"
	IsolationModeQuarantinedLocal IsolationMode = "quarantined_local"
	IsolationModeSignedPackage    IsolationMode = "signed_package"
)

type VerificationStatus string

const (
	VerificationStatusNone      VerificationStatus = "none"
	VerificationStatusVerified  VerificationStatus = "verified"
	VerificationStatusUntrusted VerificationStatus = "untrusted"
	VerificationStatusInvalid   VerificationStatus = "invalid"
)

type ValidationIssue struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type Manifest struct {
	ID           string   `toml:"id"`
	Name         string   `toml:"name"`
	Version      string   `toml:"version"`
	APIVersion   string   `toml:"api_version"`
	Entry        string   `toml:"entry"`
	Capabilities []string `toml:"capabilities"`
	Description  string   `toml:"description"`
	Author       string   `toml:"author"`
	Homepage     string   `toml:"homepage"`
}

type InstallRecord struct {
	Manifest           Manifest           `json:"manifest"`
	Path               string             `json:"path"`
	Source             string             `json:"source"`
	Enabled            bool               `json:"enabled"`
	Status             PluginStatus       `json:"status"`
	Isolation          IsolationMode      `json:"isolation"`
	CanExecute         bool               `json:"canExecute"`
	VerificationStatus VerificationStatus `json:"verificationStatus"`
	PublisherID        string             `json:"publisherId,omitempty"`
	SigningKeyID       string             `json:"signingKeyId,omitempty"`
	Issues             []ValidationIssue  `json:"issues,omitempty"`
}

type State struct {
	PluginID string `json:"pluginId"`
	Enabled  bool   `json:"enabled"`
}

type Service struct {
	mu sync.RWMutex
}

type InstallMetadata struct {
	Source             string             `json:"source"`
	Isolation          IsolationMode      `json:"isolation"`
	CanExecute         bool               `json:"canExecute"`
	VerificationStatus VerificationStatus `json:"verificationStatus"`
	PublisherID        string             `json:"publisherId,omitempty"`
	SigningKeyID       string             `json:"signingKeyId,omitempty"`
}

func NewService() *Service {
	return &Service{}
}

func (s *Service) pluginDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".yanta", "plugins"), nil
}

func (s *Service) scanLocalPlugins() ([]InstallRecord, error) {
	root, err := s.pluginDir()
	if err != nil {
		return nil, err
	}

	if _, err := os.Stat(root); errors.Is(err, os.ErrNotExist) {
		return []InstallRecord{}, nil
	} else if err != nil {
		return nil, fmt.Errorf("stat plugin directory %s: %w", root, err)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read plugin directory %s: %w", root, err)
	}

	enabledMap := loadEnabledMap()
	communityEnabled := loadCommunityPluginsEnabled()
	records := make([]InstallRecord, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pluginPath := filepath.Join(root, entry.Name())
		manifestPath := filepath.Join(pluginPath, "plugin.toml")
		if _, err := os.Stat(manifestPath); err != nil {
			continue
		}

		var manifest Manifest
		_, decodeErr := toml.DecodeFile(manifestPath, &manifest)
		status, issues := validateManifest(manifest, decodeErr)
		if strings.TrimSpace(manifest.ID) == "" {
			manifest.ID = entry.Name()
		}

		metadata := loadInstallMetadata(filepath.Join(pluginPath, installMetadataFile))
		source := pluginSourceLocal
		isolation := IsolationModeLocal
		canExecute := true
		verificationStatus := VerificationStatusNone
		publisherID := ""
		signingKeyID := ""
		if metadata != nil {
			if strings.TrimSpace(metadata.Source) != "" {
				source = metadata.Source
			}
			if strings.TrimSpace(string(metadata.Isolation)) != "" {
				isolation = metadata.Isolation
			}
			canExecute = metadata.CanExecute
			if strings.TrimSpace(string(metadata.VerificationStatus)) != "" {
				verificationStatus = metadata.VerificationStatus
			}
			publisherID = metadata.PublisherID
			signingKeyID = metadata.SigningKeyID
		}
		if buildFailure := checkPluginBuildMetadata(pluginPath); buildFailure != nil {
			canExecute = false
			issues = append(issues, ValidationIssue{
				Code:    buildFailure.Code,
				Message: buildFailure.Message,
				Field:   requiredPluginBuildMetadataFile,
			})
		}
		enabled := enabledMap[manifest.ID] && canExecute && communityEnabled
		records = append(records, InstallRecord{
			Manifest:           manifest,
			Path:               pluginPath,
			Source:             source,
			Enabled:            enabled,
			Status:             status,
			Isolation:          isolation,
			CanExecute:         canExecute,
			VerificationStatus: verificationStatus,
			PublisherID:        publisherID,
			SigningKeyID:       signingKeyID,
			Issues:             issues,
		})
	}

	sort.Slice(records, func(i, j int) bool {
		left := records[i].Manifest.ID
		right := records[j].Manifest.ID
		if left == right {
			return records[i].Path < records[j].Path
		}
		return left < right
	})

	return records, nil
}

func (s *Service) ListInstalled() ([]InstallRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.scanLocalPlugins()
}

func (s *Service) ScanLocalPlugins() ([]InstallRecord, error) {
	return s.ListInstalled()
}

func (s *Service) GetPluginState(id string) (State, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if strings.TrimSpace(id) == "" {
		return State{}, errors.New("plugin id is required")
	}

	enabledMap := loadEnabledMap()
	communityEnabled := loadCommunityPluginsEnabled()
	return State{
		PluginID: id,
		Enabled:  enabledMap[id] && communityEnabled,
	}, nil
}

func (s *Service) GetCommunityPluginsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return loadCommunityPluginsEnabled()
}

func (s *Service) SetCommunityPluginsEnabled(enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return persistCommunityPluginsEnabled(enabled)
}

func (s *Service) SetPluginEnabled(id string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return errors.New("plugin id is required")
	}
	if trimmed == pluginStateNamespace {
		return errors.New("reserved plugin id")
	}
	records, err := s.scanLocalPlugins()
	if err != nil {
		return err
	}

	var found *InstallRecord
	for i := range records {
		if records[i].Manifest.ID == trimmed {
			found = &records[i]
			break
		}
	}
	if found == nil {
		return pluginError(PluginErrNotInstalled, fmt.Sprintf("plugin %q is not installed", trimmed))
	}
	if found.Status != PluginStatusOK {
		return pluginError(PluginErrNotOperational, fmt.Sprintf("plugin %q is not operational", trimmed))
	}
	if !found.CanExecute {
		return pluginError(
			PluginErrSandboxRestricted,
			fmt.Sprintf("plugin %q cannot execute", trimmed),
		)
	}
	return persistEnabledState(trimmed, enabled)
}

func (s *Service) InstallFromDirectory(sourcePath string) (InstallRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmedPath := strings.TrimSpace(sourcePath)
	if trimmedPath == "" {
		return InstallRecord{}, pluginError(PluginErrBadSource, "source path is required")
	}
	info, err := os.Stat(trimmedPath)
	if err != nil {
		return InstallRecord{}, pluginError(PluginErrBadSource, fmt.Sprintf("source path not accessible: %v", err))
	}
	if !info.IsDir() {
		return InstallRecord{}, pluginError(PluginErrBadSource, "source path must be a directory")
	}

	manifestPath := filepath.Join(trimmedPath, "plugin.toml")
	var manifest Manifest
	_, decodeErr := toml.DecodeFile(manifestPath, &manifest)
	status, issues := validateManifest(manifest, decodeErr)
	if status == PluginStatusInvalidManifest {
		return InstallRecord{}, pluginError(PluginErrInvalidManifest, summarizeIssues(issues))
	}
	if status == PluginStatusIncompatibleAPI {
		return InstallRecord{}, pluginError(PluginErrIncompatibleAPI, summarizeIssues(issues))
	}
	entryPath := filepath.Join(trimmedPath, requiredPluginEntrypoint)
	entryInfo, err := os.Stat(entryPath)
	if err != nil {
		return InstallRecord{}, pluginError(
			PluginErrInvalidManifest,
			fmt.Sprintf("required runtime entry %q is missing", requiredPluginEntrypoint),
		)
	}
	if entryInfo.IsDir() {
		return InstallRecord{}, pluginError(
			PluginErrInvalidManifest,
			fmt.Sprintf("required runtime entry %q must be a file", requiredPluginEntrypoint),
		)
	}
	if buildFailure := checkPluginBuildMetadata(trimmedPath); buildFailure != nil {
		return InstallRecord{}, pluginError(buildFailure.Code, buildFailure.Message)
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
	} else if !errors.Is(err, os.ErrNotExist) {
		return InstallRecord{}, fmt.Errorf("stat destination %s: %w", destPath, err)
	}

	if err := copyDirectory(trimmedPath, destPath); err != nil {
		_ = os.RemoveAll(destPath)
		return InstallRecord{}, fmt.Errorf("copy plugin files: %w", err)
	}

	if err := persistEnabledState(manifest.ID, false); err != nil {
		_ = os.RemoveAll(destPath)
		return InstallRecord{}, err
	}

	return InstallRecord{
		Manifest:           manifest,
		Path:               destPath,
		Source:             pluginSourceLocal,
		Enabled:            false,
		Status:             PluginStatusOK,
		Isolation:          IsolationModeLocal,
		CanExecute:         true,
		VerificationStatus: VerificationStatusNone,
	}, nil
}

func (s *Service) Uninstall(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return errors.New("plugin id is required")
	}
	if trimmed == pluginStateNamespace {
		return errors.New("reserved plugin id")
	}

	root, err := s.pluginDir()
	if err != nil {
		return err
	}
	pluginPath := filepath.Join(root, trimmed)
	if _, err := os.Stat(pluginPath); errors.Is(err, os.ErrNotExist) {
		return pluginError(PluginErrNotInstalled, fmt.Sprintf("plugin %q is not installed", trimmed))
	} else if err != nil {
		return fmt.Errorf("stat plugin path %s: %w", pluginPath, err)
	}

	if err := os.RemoveAll(pluginPath); err != nil {
		return fmt.Errorf("remove plugin path %s: %w", pluginPath, err)
	}

	overrides := config.GetPreferencesOverrides()
	if overrides.Plugins == nil {
		return nil
	}

	delete(overrides.Plugins, trimmed)

	stateConfig := clonePluginConfig(overrides.Plugins[pluginStateNamespace])
	enabledMap := normalizeEnabledMap(stateConfig[pluginStateEnabledKey])
	delete(enabledMap, trimmed)
	if len(enabledMap) > 0 {
		stateConfig[pluginStateEnabledKey] = enabledMap
	} else {
		delete(stateConfig, pluginStateEnabledKey)
	}
	if len(stateConfig) > 0 {
		overrides.Plugins[pluginStateNamespace] = stateConfig
	} else {
		delete(overrides.Plugins, pluginStateNamespace)
	}
	if len(overrides.Plugins) == 0 {
		overrides.Plugins = nil
	}

	if err := config.SetPreferencesOverrides(overrides); err != nil {
		return fmt.Errorf("persist plugin uninstall state: %w", err)
	}

	return nil
}

func persistEnabledState(pluginID string, enabled bool) error {
	overrides := config.GetPreferencesOverrides()
	if overrides.Plugins == nil {
		overrides.Plugins = map[string]config.PreferencesPluginConfig{}
	}

	stateConfig := clonePluginConfig(overrides.Plugins[pluginStateNamespace])
	enabledMap := normalizeEnabledMap(stateConfig[pluginStateEnabledKey])
	enabledMap[pluginID] = enabled
	stateConfig[pluginStateEnabledKey] = enabledMap
	overrides.Plugins[pluginStateNamespace] = stateConfig

	if err := config.SetPreferencesOverrides(overrides); err != nil {
		return fmt.Errorf("persist plugin state: %w", err)
	}
	return nil
}

func copyDirectory(sourcePath string, destPath string) error {
	srcInfo, err := os.Stat(sourcePath)
	if err != nil {
		return fmt.Errorf("stat source directory %s: %w", sourcePath, err)
	}
	if !srcInfo.IsDir() {
		return fmt.Errorf("source path %s is not a directory", sourcePath)
	}
	if err := os.MkdirAll(destPath, srcInfo.Mode().Perm()); err != nil {
		return fmt.Errorf("create destination directory %s: %w", destPath, err)
	}

	entries, err := os.ReadDir(sourcePath)
	if err != nil {
		return fmt.Errorf("read source directory %s: %w", sourcePath, err)
	}
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 {
			continue
		}

		src := filepath.Join(sourcePath, entry.Name())
		dst := filepath.Join(destPath, entry.Name())
		if entry.IsDir() {
			if err := copyDirectory(src, dst); err != nil {
				return err
			}
			continue
		}
		if err := copyFile(src, dst); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(sourcePath string, destPath string) error {
	srcInfo, err := os.Stat(sourcePath)
	if err != nil {
		return fmt.Errorf("stat source file %s: %w", sourcePath, err)
	}

	in, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open source file %s: %w", sourcePath, err)
	}
	defer in.Close()

	out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, srcInfo.Mode().Perm())
	if err != nil {
		return fmt.Errorf("open destination file %s: %w", destPath, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("copy %s to %s: %w", sourcePath, destPath, err)
	}
	return nil
}

func isManifestValid(m Manifest) bool {
	return len(manifestValidationIssues(m)) == 0
}

func validateManifest(m Manifest, decodeErr error) (PluginStatus, []ValidationIssue) {
	issues := []ValidationIssue{}
	if decodeErr != nil {
		issues = append(issues, ValidationIssue{
			Code:    "MANIFEST_DECODE_ERROR",
			Message: decodeErr.Error(),
			Field:   "plugin.toml",
		})
	}
	issues = append(issues, manifestValidationIssues(m)...)
	if len(issues) > 0 {
		return PluginStatusInvalidManifest, issues
	}
	if !isAPIVersionCompatible(m.APIVersion) {
		return PluginStatusIncompatibleAPI, []ValidationIssue{
			{
				Code:    "INCOMPATIBLE_API_VERSION",
				Message: fmt.Sprintf("plugin api_version %q is not supported (expected major %d)", m.APIVersion, SupportedPluginAPIMajor),
				Field:   "api_version",
			},
		}
	}
	return PluginStatusOK, nil
}

func manifestValidationIssues(m Manifest) []ValidationIssue {
	issues := []ValidationIssue{}
	if strings.TrimSpace(m.ID) == "" {
		issues = append(issues, ValidationIssue{
			Code:    "MISSING_REQUIRED_FIELD",
			Message: "missing required field: id",
			Field:   "id",
		})
	}
	if strings.TrimSpace(m.Name) == "" {
		issues = append(issues, ValidationIssue{
			Code:    "MISSING_REQUIRED_FIELD",
			Message: "missing required field: name",
			Field:   "name",
		})
	}
	if strings.TrimSpace(m.Version) == "" {
		issues = append(issues, ValidationIssue{
			Code:    "MISSING_REQUIRED_FIELD",
			Message: "missing required field: version",
			Field:   "version",
		})
	}
	if strings.TrimSpace(m.APIVersion) == "" {
		issues = append(issues, ValidationIssue{
			Code:    "MISSING_REQUIRED_FIELD",
			Message: "missing required field: api_version",
			Field:   "api_version",
		})
	}
	if strings.TrimSpace(m.Entry) == "" {
		issues = append(issues, ValidationIssue{
			Code:    "MISSING_REQUIRED_FIELD",
			Message: "missing required field: entry",
			Field:   "entry",
		})
	} else if strings.TrimSpace(m.Entry) != requiredPluginEntrypoint {
		issues = append(issues, ValidationIssue{
			Code:    "INVALID_ENTRYPOINT",
			Message: fmt.Sprintf("entry must be %q", requiredPluginEntrypoint),
			Field:   "entry",
		})
	}
	if strings.TrimSpace(m.ID) == pluginStateNamespace {
		issues = append(issues, ValidationIssue{
			Code:    "RESERVED_PLUGIN_ID",
			Message: "plugin id uses reserved namespace",
			Field:   "id",
		})
	}
	return issues
}

func isAPIVersionCompatible(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}
	majorPart := trimmed
	if idx := strings.Index(trimmed, "."); idx >= 0 {
		majorPart = trimmed[:idx]
	}
	major, err := strconv.Atoi(majorPart)
	if err != nil {
		return false
	}
	return major == SupportedPluginAPIMajor
}

func summarizeIssues(issues []ValidationIssue) string {
	if len(issues) == 0 {
		return "manifest validation failed"
	}
	messages := make([]string, 0, len(issues))
	for _, issue := range issues {
		messages = append(messages, issue.Message)
	}
	return strings.Join(messages, "; ")
}

func pluginError(code, message string) error {
	return fmt.Errorf("%s: %s", code, message)
}
func (s *Service) GetPluginDirectory() (string, error) {
	return s.pluginDir()
}

func (s *Service) ReadPluginEntrypoint(id string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return "", errors.New("plugin id is required")
	}

	records, err := s.scanLocalPlugins()
	if err != nil {
		return "", err
	}

	var found *InstallRecord
	for i := range records {
		if records[i].Manifest.ID == trimmed {
			found = &records[i]
			break
		}
	}
	if found == nil {
		return "", pluginError(PluginErrNotInstalled, fmt.Sprintf("plugin %q is not installed", trimmed))
	}
	if found.Status != PluginStatusOK {
		return "", pluginError(PluginErrNotOperational, fmt.Sprintf("plugin %q is not operational", trimmed))
	}
	if !found.CanExecute {
		return "", pluginError(
			PluginErrSandboxRestricted,
			fmt.Sprintf("plugin %q cannot execute", trimmed),
		)
	}

	entry := strings.TrimSpace(found.Manifest.Entry)
	if entry == "" {
		return "", pluginError(PluginErrInvalidManifest, "missing plugin entry")
	}
	if strings.HasPrefix(entry, "builtin:") {
		return "", pluginError(PluginErrBadSource, "builtin plugin entrypoints are embedded in frontend bundle")
	}
	if filepath.IsAbs(entry) {
		return "", pluginError(PluginErrInvalidManifest, "plugin entry must be relative path")
	}

	entryPath := filepath.Join(found.Path, filepath.Clean(entry))
	if !strings.HasPrefix(entryPath, found.Path+string(os.PathSeparator)) && entryPath != found.Path {
		return "", pluginError(PluginErrInvalidManifest, "plugin entry escapes plugin root")
	}
	entryInfo, err := os.Stat(entryPath)
	if err != nil {
		return "", pluginError(PluginErrBadSource, fmt.Sprintf("plugin entry not accessible: %v", err))
	}
	if entryInfo.IsDir() {
		return "", pluginError(PluginErrBadSource, "plugin entry must be a file")
	}

	content, err := os.ReadFile(entryPath)
	if err != nil {
		return "", pluginError(PluginErrBadSource, fmt.Sprintf("read plugin entry failed: %v", err))
	}
	return string(content), nil
}

func loadEnabledMap() map[string]bool {
	overrides := config.GetPreferencesOverrides()
	stateConfig := overrides.Plugins[pluginStateNamespace]
	enabledRaw, ok := stateConfig[pluginStateEnabledKey]
	if !ok {
		return map[string]bool{}
	}
	return normalizeEnabledMap(enabledRaw)
}

func loadCommunityPluginsEnabled() bool {
	overrides := config.GetPreferencesOverrides()
	stateConfig := overrides.Plugins[pluginStateNamespace]
	raw, ok := stateConfig[pluginStateCommunityEnabledKey]
	if !ok {
		return false
	}
	enabled, ok := raw.(bool)
	if !ok {
		return false
	}
	return enabled
}

func persistCommunityPluginsEnabled(enabled bool) error {
	overrides := config.GetPreferencesOverrides()
	if overrides.Plugins == nil {
		overrides.Plugins = map[string]config.PreferencesPluginConfig{}
	}

	stateConfig := clonePluginConfig(overrides.Plugins[pluginStateNamespace])
	stateConfig[pluginStateCommunityEnabledKey] = enabled
	overrides.Plugins[pluginStateNamespace] = stateConfig

	if err := config.SetPreferencesOverrides(overrides); err != nil {
		return fmt.Errorf("persist community plugin mode: %w", err)
	}
	return nil
}

func normalizeEnabledMap(raw any) map[string]bool {
	result := map[string]bool{}
	if raw == nil {
		return result
	}

	switch typed := raw.(type) {
	case map[string]any:
		for key, val := range typed {
			if b, ok := val.(bool); ok {
				result[key] = b
			}
		}
	case map[string]bool:
		for key, val := range typed {
			result[key] = val
		}
	}
	return result
}

func clonePluginConfig(src config.PreferencesPluginConfig) config.PreferencesPluginConfig {
	dst := config.PreferencesPluginConfig{}
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
