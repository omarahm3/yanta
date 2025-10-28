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
	RepositoryPath string `toml:"repository_path"`
	RemoteURL      string `toml:"remote_url"`
	AutoCommit     bool   `toml:"auto_commit"`
	AutoPush       bool   `toml:"auto_push"`
}

type Config struct {
	LogLevel         string        `toml:"log_level"`
	KeepInBackground bool          `toml:"keep_in_background"`
	StartHidden      bool          `toml:"start_hidden"`
	DataDirectory    string        `toml:"data_directory"`
	GitSync          GitSyncConfig `toml:"git_sync"`
}

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
	cfg := Get()
	if cfg.DataDirectory != "" {
		return cfg.DataDirectory
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".yanta")
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
