package plugins

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"

	"yanta/internal/config"
)

const pluginStateNamespace = "__plugin_state"
const pluginStateEnabledKey = "enabled"

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
	Manifest Manifest `json:"manifest"`
	Path     string   `json:"path"`
	Source   string   `json:"source"`
	Enabled  bool     `json:"enabled"`
}

type State struct {
	PluginID string `json:"pluginId"`
	Enabled  bool   `json:"enabled"`
}

type Service struct {
	mu sync.RWMutex
}

func NewService() *Service {
	return &Service{}
}

func (s *Service) pluginDir() (string, error) {
	root := config.GetAppRootDirectory()
	if root == "" {
		return "", fmt.Errorf("resolve app root directory: empty path")
	}
	return filepath.Join(root, "plugins"), nil
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
		if _, err := toml.DecodeFile(manifestPath, &manifest); err != nil {
			continue
		}

		if !isManifestValid(manifest) {
			continue
		}

		records = append(records, InstallRecord{
			Manifest: manifest,
			Path:     pluginPath,
			Source:   "local",
			Enabled:  enabledMap[manifest.ID],
		})
	}

	sort.Slice(records, func(i, j int) bool {
		return records[i].Manifest.ID < records[j].Manifest.ID
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
	return State{
		PluginID: id,
		Enabled:  enabledMap[id],
	}, nil
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

	overrides := config.GetPreferencesOverrides()
	if overrides.Plugins == nil {
		overrides.Plugins = map[string]config.PreferencesPluginConfig{}
	}

	stateConfig := clonePluginConfig(overrides.Plugins[pluginStateNamespace])
	enabledMap := normalizeEnabledMap(stateConfig[pluginStateEnabledKey])
	enabledMap[trimmed] = enabled
	stateConfig[pluginStateEnabledKey] = enabledMap
	overrides.Plugins[pluginStateNamespace] = stateConfig

	if err := config.SetPreferencesOverrides(overrides); err != nil {
		return fmt.Errorf("persist plugin state: %w", err)
	}

	return nil
}

func (s *Service) GetPluginDirectory() (string, error) {
	return s.pluginDir()
}

func isManifestValid(m Manifest) bool {
	return strings.TrimSpace(m.ID) != "" &&
		strings.TrimSpace(m.Name) != "" &&
		strings.TrimSpace(m.Version) != "" &&
		strings.TrimSpace(m.APIVersion) != "" &&
		strings.TrimSpace(m.Entry) != ""
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
