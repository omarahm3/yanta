// Package config handles application configuration loading and management.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"
	"github.com/sirupsen/logrus"
)

type GitSyncConfig struct {
	Enabled        bool   `toml:"enabled"`
	AutoCommit     bool   `toml:"auto_commit"`
	AutoPush       bool   `toml:"auto_push"`
	CommitInterval int    `toml:"commit_interval"` // minutes between auto-commits, 0 = manual only
	Branch         string `toml:"branch"`          // branch to sync, empty = use current branch
}

type BackupConfig struct {
	Enabled    bool `toml:"enabled"`
	MaxBackups int  `toml:"max_backups"` // number of backups to retain, 0 = unlimited
}

type HotkeyConfig struct {
	QuickCaptureEnabled   bool     `toml:"quick_capture_enabled"`
	QuickCaptureModifiers []string `toml:"quick_capture_modifiers"` // e.g., ["Ctrl", "Shift"]
	QuickCaptureKey       string   `toml:"quick_capture_key"`       // e.g., "N"
}

// PreferencesOverrides holds user-configurable overrides for shortcuts, timeouts, and layout.
// Stored in config.toml under [preferences]. Only non-zero/non-empty values are applied.
type PreferencesTimeoutsOverrides struct {
	AutoSaveDebounceMs        int `toml:"auto_save_debounce_ms"`
	TooltipHoverDelay         int `toml:"tooltip_hover_delay"`
	TooltipFocusDelay         int `toml:"tooltip_focus_delay"`
	ScrollDebounceMs          int `toml:"scroll_debounce_ms"`
	SearchDebounceMs          int `toml:"search_debounce_ms"`
	SavePersistenceDebounceMs int `toml:"save_persistence_debounce_ms"`
}

type PreferencesShortcutsOverrides struct {
	Global       map[string]string `toml:"global"`
	Sidebar      map[string]string `toml:"sidebar"`
	Document     map[string]string `toml:"document"`
	Dashboard    map[string]string `toml:"dashboard"`
	Journal      map[string]string `toml:"journal"`
	Projects     map[string]string `toml:"projects"`
	QuickCapture map[string]string `toml:"quick_capture"`
	Settings     map[string]string `toml:"settings"`
	CommandLine  map[string]string `toml:"command_line"`
	Search       map[string]string `toml:"search"`
	Pane         map[string]string `toml:"pane"`
}

type PreferencesLayoutOverrides struct {
	MaxPanes int `toml:"max_panes"`
}

type PreferencesGraphicsOverrides struct {
	LinuxMode string `toml:"linux_mode"`
}

// PreferencesPluginConfig holds key-value overrides for a single plugin.
// Schema validation is done on the frontend; backend stores and passes through.
type PreferencesPluginConfig map[string]any

// PreferencesOverrides holds user-configurable overrides for shortcuts, timeouts, layout, and plugins.
// Stored in config.toml under [preferences]. Plugin config under [preferences.plugins.<plugin-id>].
type PreferencesOverrides struct {
	Timeouts  PreferencesTimeoutsOverrides       `toml:"timeouts"`
	Shortcuts PreferencesShortcutsOverrides      `toml:"shortcuts"`
	Layout    PreferencesLayoutOverrides         `toml:"layout"`
	Graphics  PreferencesGraphicsOverrides       `toml:"graphics"`
	Plugins   map[string]PreferencesPluginConfig `toml:"plugins"`
}

type Config struct {
	LogLevel             string               `toml:"log_level"`
	KeepInBackground     bool                 `toml:"keep_in_background"`
	StartHidden          bool                 `toml:"start_hidden"`
	DataDirectory        string               `toml:"data_directory"`
	GitSync              GitSyncConfig        `toml:"git_sync"`
	Backup               BackupConfig         `toml:"backup"`
	LinuxWindowMode      string               `toml:"linux_window_mode"`
	AppScale             float64              `toml:"app_scale"`
	Hotkey               HotkeyConfig         `toml:"hotkey"`
	SidebarVisible       bool                 `toml:"sidebar_visible"`
	ShowFooterHints      bool                 `toml:"show_footer_hints"`
	ShowShortcutTooltips bool                 `toml:"show_shortcut_tooltips"`
	Preferences          PreferencesOverrides `toml:"preferences"`
}

const (
	WindowModeNormal    = "normal"
	WindowModeFrameless = "frameless"

	LinuxGraphicsModeAuto     = "auto"
	LinuxGraphicsModeNative   = "native"
	LinuxGraphicsModeCompat   = "compat"
	LinuxGraphicsModeSoftware = "software"
)

var (
	instance     *Config
	instanceOnce sync.Once
	mu           sync.RWMutex
)

func Init() error {
	var initErr error
	instanceOnce.Do(func() {
		cfg := &Config{
			LogLevel:         "info",
			KeepInBackground: false,
			StartHidden:      false,
			AppScale:         1.0,
			Backup: BackupConfig{
				Enabled:    true,
				MaxBackups: 10,
			},
		}

		configPath, err := getConfigPath()
		if err != nil {
			instance = cfg
			return
		}

		if _, err := os.Stat(configPath); !os.IsNotExist(err) {
			if _, err := toml.DecodeFile(configPath, cfg); err != nil {
				initErr = fmt.Errorf("failed to decode config: %w", err)
				instance = &Config{
					LogLevel:         "info",
					KeepInBackground: false,
					StartHidden:      false,
				}
				return
			}
		}

		if cfg.LogLevel == "" {
			cfg.LogLevel = "info"
		}

		if level := os.Getenv("YANTA_LOG_LEVEL"); level != "" {
			cfg.LogLevel = strings.ToLower(level)
		}

		if cfg.AppScale < 0.75 || cfg.AppScale > 2.0 {
			cfg.AppScale = 1.0
		}

		if cfg.Backup.MaxBackups == 0 {
			cfg.Backup.MaxBackups = 10
		}

		instance = cfg
	})
	return initErr
}

func Get() *Config {
	mu.RLock()
	defer mu.RUnlock()

	if instance == nil {
		return &Config{LogLevel: "info"}
	}
	return instance
}

func GetLogLevel() string {
	return Get().LogLevel
}

func SetLogLevel(level string) error {
	if _, err := logrus.ParseLevel(level); err != nil {
		return fmt.Errorf("invalid log level: %w", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.LogLevel = level
	return save(instance)
}

func GetKeepInBackground() bool {
	if runtime.GOOS == "linux" {
		return false
	}
	return Get().KeepInBackground
}

func SetKeepInBackground(keep bool) error {
	if runtime.GOOS == "linux" {
		return fmt.Errorf("keep_in_background is not supported on Linux")
	}

	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.KeepInBackground = keep

	if !keep {
		instance.StartHidden = false
	}

	return save(instance)
}

func GetStartHidden() bool {
	if runtime.GOOS == "linux" {
		return false
	}
	cfg := Get()
	return cfg.KeepInBackground && cfg.StartHidden
}

func SetStartHidden(hidden bool) error {
	if runtime.GOOS == "linux" {
		return fmt.Errorf("start_hidden is not supported on Linux")
	}

	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	if hidden && !instance.KeepInBackground {
		return fmt.Errorf("cannot enable start_hidden when keep_in_background is disabled")
	}

	instance.StartHidden = hidden
	return save(instance)
}

func getConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	return filepath.Join(home, ".yanta", "config.toml"), nil
}

func save(cfg *Config) error {
	configPath, err := getConfigPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	f, err := os.Create(configPath)
	if err != nil {
		return fmt.Errorf("failed to create config file: %w", err)
	}
	defer f.Close()

	encoder := toml.NewEncoder(f)
	if err := encoder.Encode(cfg); err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	return nil
}

func GetDataDirectory() string {
	if envDir := os.Getenv("YANTA_DATA_DIR"); envDir != "" {
		return envDir
	}

	cfg := Get()
	if cfg.DataDirectory != "" {
		return cfg.DataDirectory
	}

	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta")
}

// IsDataDirectoryOverridden returns true if YANTA_DATA_DIR env var is set,
// which overrides any config file setting. This is useful for warning users
// that changing the data directory via the UI won't take effect.
func IsDataDirectoryOverridden() bool {
	return os.Getenv("YANTA_DATA_DIR") != ""
}

// GetDataDirectoryEnvVar returns the value of YANTA_DATA_DIR if set, empty string otherwise.
func GetDataDirectoryEnvVar() string {
	return os.Getenv("YANTA_DATA_DIR")
}

func SetDataDirectory(dir string) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.DataDirectory = dir
	return save(instance)
}

func GetGitSyncConfig() GitSyncConfig {
	cfg := Get()
	return cfg.GitSync
}

func SetGitSyncConfig(gitCfg GitSyncConfig) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.GitSync = gitCfg
	return save(instance)
}

func ResetForTesting() {
	mu.Lock()
	defer mu.Unlock()
	instance = nil
	instanceOnce = sync.Once{}
}

func GetLinuxWindowMode() string {
	cfg := Get()
	if cfg.LinuxWindowMode == "" {
		return WindowModeNormal
	}
	return cfg.LinuxWindowMode
}

func SetLinuxWindowMode(mode string) error {
	if mode != WindowModeNormal && mode != WindowModeFrameless {
		return fmt.Errorf("invalid window mode: %s (must be 'normal' or 'frameless')", mode)
	}

	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.LinuxWindowMode = mode
	return save(instance)
}

func IsLinuxFrameless() bool {
	return runtime.GOOS == "linux" && GetLinuxWindowMode() == WindowModeFrameless
}

func GetAppScale() float64 {
	cfg := Get()
	if cfg.AppScale < 0.75 || cfg.AppScale > 2.0 {
		return 1.0
	}
	return cfg.AppScale
}

func SetAppScale(scale float64) error {
	if scale < 0.75 || scale > 2.0 {
		return fmt.Errorf("app scale must be between 0.75 and 2.0")
	}

	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.AppScale = scale
	return save(instance)
}

func GetBackupConfig() BackupConfig {
	cfg := Get()
	return cfg.Backup
}

func SetBackupConfig(backupCfg BackupConfig) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.Backup = backupCfg
	return save(instance)
}

// GetDefaultHotkeyConfig returns platform-specific default hotkey configuration.
// Windows: Ctrl+Shift+N enabled by default.
// macOS/Linux: disabled (users should configure via system/WM shortcuts).
func GetDefaultHotkeyConfig() HotkeyConfig {
	if runtime.GOOS == "windows" {
		return HotkeyConfig{
			QuickCaptureEnabled:   true,
			QuickCaptureModifiers: []string{"Ctrl", "Shift"},
			QuickCaptureKey:       "N",
		}
	}
	// macOS and Linux: disabled by default
	return HotkeyConfig{
		QuickCaptureEnabled:   false,
		QuickCaptureModifiers: []string{"Ctrl", "Shift"},
		QuickCaptureKey:       "N",
	}
}

func GetHotkeyConfig() HotkeyConfig {
	cfg := Get()
	// If not configured, return platform defaults
	if cfg.Hotkey.QuickCaptureKey == "" {
		return GetDefaultHotkeyConfig()
	}
	return cfg.Hotkey
}

func SetHotkeyConfig(hotkeyCfg HotkeyConfig) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.Hotkey = hotkeyCfg
	return save(instance)
}

func GetSidebarVisible() bool {
	return Get().SidebarVisible
}

func SetSidebarVisible(visible bool) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.SidebarVisible = visible
	return save(instance)
}

func GetShowFooterHints() bool {
	return Get().ShowFooterHints
}

func SetShowFooterHints(show bool) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.ShowFooterHints = show
	return save(instance)
}

func GetShowShortcutTooltips() bool {
	return Get().ShowShortcutTooltips
}

func SetShowShortcutTooltips(show bool) error {
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.ShowShortcutTooltips = show
	return save(instance)
}

func GetPreferencesOverrides() PreferencesOverrides {
	cfg := Get()
	if cfg == nil {
		return PreferencesOverrides{}
	}
	return cfg.Preferences
}

func SetPreferencesOverrides(overrides PreferencesOverrides) error {
	validated := validatePreferencesOverrides(overrides)
	mu.Lock()
	defer mu.Unlock()

	if instance == nil {
		instance = &Config{}
	}

	instance.Preferences = validated
	return save(instance)
}

func GetLinuxGraphicsMode() string {
	mode := GetPreferencesOverrides().Graphics.LinuxMode
	if mode == "" {
		return LinuxGraphicsModeAuto
	}

	switch mode {
	case LinuxGraphicsModeAuto, LinuxGraphicsModeNative, LinuxGraphicsModeCompat, LinuxGraphicsModeSoftware:
		return mode
	default:
		return LinuxGraphicsModeAuto
	}
}

// validatePreferencesOverrides validates and sanitizes overrides.
// Invalid values are reset to zero (meaning "use default"); unknown shortcut keys are ignored.
func validatePreferencesOverrides(overrides PreferencesOverrides) PreferencesOverrides {
	validated := overrides

	// Timeouts: bounds 100-30000 ms for debounce values
	const minMs, maxMs = 100, 30000
	if validated.Timeouts.AutoSaveDebounceMs != 0 {
		if validated.Timeouts.AutoSaveDebounceMs < minMs || validated.Timeouts.AutoSaveDebounceMs > maxMs {
			logrus.Warnf("preferences.timeouts.auto_save_debounce_ms %d out of range [%d,%d], using default",
				validated.Timeouts.AutoSaveDebounceMs, minMs, maxMs)
			validated.Timeouts.AutoSaveDebounceMs = 0
		}
	}
	if validated.Timeouts.TooltipHoverDelay != 0 {
		if validated.Timeouts.TooltipHoverDelay < 0 || validated.Timeouts.TooltipHoverDelay > maxMs {
			logrus.Warnf("preferences.timeouts.tooltip_hover_delay %d out of range [0,%d], using default",
				validated.Timeouts.TooltipHoverDelay, maxMs)
			validated.Timeouts.TooltipHoverDelay = 0
		}
	}
	if validated.Timeouts.TooltipFocusDelay != 0 {
		if validated.Timeouts.TooltipFocusDelay < 0 || validated.Timeouts.TooltipFocusDelay > maxMs {
			validated.Timeouts.TooltipFocusDelay = 0
		}
	}

	// Layout: max_panes 2-8
	if validated.Layout.MaxPanes != 0 {
		if validated.Layout.MaxPanes < 2 || validated.Layout.MaxPanes > 8 {
			logrus.Warnf("preferences.layout.max_panes %d out of range [2,8], using default",
				validated.Layout.MaxPanes)
			validated.Layout.MaxPanes = 0
		}
	}

	// Graphics: linux_mode enum
	if validated.Graphics.LinuxMode != "" {
		switch validated.Graphics.LinuxMode {
		case LinuxGraphicsModeAuto, LinuxGraphicsModeNative, LinuxGraphicsModeCompat, LinuxGraphicsModeSoftware:
			// valid
		default:
			logrus.Warnf("preferences.graphics.linux_mode %q is invalid, using default", validated.Graphics.LinuxMode)
			validated.Graphics.LinuxMode = ""
		}
	}

	return validated
}
