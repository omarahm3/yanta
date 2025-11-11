package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"yanta/internal/config"
	"yanta/internal/paths"

	"github.com/sirupsen/logrus"
)

var Log *logrus.Logger

type Config struct {
	Level      string
	LogFile    string
	LogDir     string
	MaxSize    int64
	MaxBackups int
	MaxAge     int
	Compress   bool
}

func DefaultConfig() *Config {
	return &Config{
		Level:      "info",
		LogFile:    "yanta.log",
		LogDir:     paths.GetLogsPath(),
		MaxSize:    10 * 1024 * 1024,
		MaxBackups: 3,
		MaxAge:     28,
		Compress:   true,
	}
}

func Init(config *Config) error {
	if config == nil {
		config = DefaultConfig()
	}

	Log = logrus.New()

	level, err := logrus.ParseLevel(config.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	Log.SetLevel(level)

	Log.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
		ForceColors:     false,
		CallerPrettyfier: func(f *runtime.Frame) (string, string) {
			filename := filepath.Base(f.File)
			return "", fmt.Sprintf("%s:%d %s()", filename, f.Line, f.Function)
		},
	})
	Log.SetReportCaller(true)

	var writers []io.Writer = []io.Writer{os.Stdout}

	if config.LogFile != "" {
		if err := os.MkdirAll(config.LogDir, 0755); err != nil {
			writeEmergencyLog(config.LogDir, fmt.Sprintf("Failed to create log directory: %v", err))
			return fmt.Errorf("creating log directory %s: %w", config.LogDir, err)
		}

		logFilePath := filepath.Join(config.LogDir, config.LogFile)
		logFile, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			writeEmergencyLog(
				config.LogDir,
				fmt.Sprintf("Failed to open log file %s: %v", logFilePath, err),
			)
			return fmt.Errorf("opening log file %s: %w", logFilePath, err)
		}

		writers = append(writers, logFile)
	}

	Log.SetOutput(io.MultiWriter(writers...))
	Log.WithFields(logrus.Fields{
		"level":   config.Level,
		"logFile": config.LogFile,
		"logDir":  config.LogDir,
	}).Info("Logger initialized")

	return nil
}

func writeEmergencyLog(logDir, message string) {
	emergencyPath := filepath.Join(logDir, "emergency.log")
	f, err := os.OpenFile(emergencyPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "[%s] %s\n", filepath.Base(os.Args[0]), message)
}

func InitFromEnv() error {
	cfg := DefaultConfig()
	cfg.Level = config.GetLogLevel()

	if logFile := os.Getenv("YANTA_LOG_FILE"); logFile != "" {
		cfg.LogFile = logFile
	}

	if logDir := os.Getenv("YANTA_LOG_DIR"); logDir != "" {
		cfg.LogDir = logDir
	}

	return Init(cfg)
}

func GetLogger() *logrus.Logger {
	if Log == nil {
		Init(DefaultConfig())
	}
	return Log
}

func Debug(args ...any) {
	GetLogger().Debug(args...)
}

func Debugf(format string, args ...any) {
	GetLogger().Debugf(format, args...)
}

func Info(args ...any) {
	GetLogger().Info(args...)
}

func Infof(format string, args ...any) {
	GetLogger().Infof(format, args...)
}

func Warn(args ...any) {
	GetLogger().Warn(args...)
}

func Warnf(format string, args ...any) {
	GetLogger().Warnf(format, args...)
}

func Error(args ...any) {
	GetLogger().Error(args...)
}

func Errorf(format string, args ...any) {
	GetLogger().Errorf(format, args...)
}

func Fatal(args ...any) {
	GetLogger().Fatal(args...)
}

func Fatalf(format string, args ...any) {
	GetLogger().Fatalf(format, args...)
}

func Panic(args ...any) {
	GetLogger().Panic(args...)
}

func Panicf(format string, args ...any) {
	GetLogger().Panicf(format, args...)
}

func WithField(key string, value any) *logrus.Entry {
	return GetLogger().WithField(key, value)
}

func WithFields(fields logrus.Fields) *logrus.Entry {
	return GetLogger().WithFields(fields)
}

func WithError(err error) *logrus.Entry {
	return GetLogger().WithError(err)
}
