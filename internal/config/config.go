package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"
	"github.com/sirupsen/logrus"
)

type Config struct {
	LogLevel string `toml:"log_level"`
}

var (
	instance     *Config
	instanceOnce sync.Once
	mu           sync.RWMutex
)

func Init() error {
	var initErr error
	instanceOnce.Do(func() {
		cfg := &Config{LogLevel: "info"}

		configPath, err := getConfigPath()
		if err != nil {
			instance = cfg
			return
		}

		if _, err := os.Stat(configPath); !os.IsNotExist(err) {
			if _, err := toml.DecodeFile(configPath, cfg); err != nil {
				initErr = fmt.Errorf("failed to decode config: %w", err)
				instance = &Config{LogLevel: "info"}
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
