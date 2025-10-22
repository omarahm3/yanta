package system

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"yanta/internal/config"
	"yanta/internal/logger"

	"github.com/sirupsen/logrus"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	BuildVersion = "dev"
	BuildCommit  = ""
	BuildDate    = ""
)

type Service struct {
	db     *sql.DB
	dbPath string
	ctx    context.Context
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:     db,
		dbPath: "",
	}
}

func (s *Service) SetDBPath(path string) {
	s.dbPath = path
}

func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

type AppInfo struct {
	Version      string `json:"version"`
	BuildCommit  string `json:"buildCommit"`
	BuildDate    string `json:"buildDate"`
	Platform     string `json:"platform"`
	GoVersion    string `json:"goVersion"`
	DatabasePath string `json:"databasePath"`
	LogLevel     string `json:"logLevel"`
}

type DatabaseInfo struct {
	EntriesCount  int64  `json:"entriesCount"`
	ProjectsCount int64  `json:"projectsCount"`
	TagsCount     int64  `json:"tagsCount"`
	StorageUsed   string `json:"storageUsed"`
}

type SystemInfo struct {
	App      AppInfo      `json:"app"`
	Database DatabaseInfo `json:"database"`
}

func (s *Service) GetSystemInfo() (*SystemInfo, error) {
	logger.Info("getting system information")

	appInfo := AppInfo{
		Version:     BuildVersion,
		BuildCommit: BuildCommit,
		BuildDate:   BuildDate,
		Platform:    fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
		GoVersion:   runtime.Version(),
		LogLevel:    logger.GetLogger().GetLevel().String(),
	}

	dbInfo, err := s.getDatabaseInfo()
	if err != nil {
		logger.Errorf("failed to get database info: %v", err)
		return nil, err
	}

	return &SystemInfo{
		App:      appInfo,
		Database: *dbInfo,
	}, nil
}

func (s *Service) getDatabaseInfo() (*DatabaseInfo, error) {
	var entriesCount, projectsCount, tagsCount int64

	err := s.db.QueryRow("SELECT COUNT(*) FROM doc WHERE deleted_at IS NULL").Scan(&entriesCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count documents: %w", err)
	}

	err = s.db.QueryRow("SELECT COUNT(*) FROM project WHERE deleted_at IS NULL").
		Scan(&projectsCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count projects: %w", err)
	}

	err = s.db.QueryRow("SELECT COUNT(*) FROM tag WHERE deleted_at IS NULL").Scan(&tagsCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count tags: %w", err)
	}

	var storageUsed string
	dbPath := s.dbPath
	if dbPath == "" {
		dbPath = "yanta.db"
	}

	if stat, err := os.Stat(dbPath); err == nil {
		sizeBytes := stat.Size()
		storageUsed = formatBytes(sizeBytes)
	} else {
		logger.Warnf("failed to get database file size: %v", err)
		storageUsed = "Unknown"
	}

	return &DatabaseInfo{
		EntriesCount:  entriesCount,
		ProjectsCount: projectsCount,
		TagsCount:     tagsCount,
		StorageUsed:   storageUsed,
	}, nil
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// LogFromFrontend allows frontend to write logs to the backend log file
func (s *Service) LogFromFrontend(level string, message string, data map[string]any) {
	fields := logger.Log.WithFields(data)

	switch level {
	case "debug":
		fields.Debug("[FRONTEND] " + message)
	case "info":
		fields.Info("[FRONTEND] " + message)
	case "warn":
		fields.Warn("[FRONTEND] " + message)
	case "error":
		fields.Error("[FRONTEND] " + message)
	default:
		fields.Info("[FRONTEND] " + message)
	}
}

func (s *Service) SetLogLevel(level string) error {
	if err := config.SetLogLevel(level); err != nil {
		return err
	}

	parsedLevel, _ := logrus.ParseLevel(level)
	logger.GetLogger().SetLevel(parsedLevel)
	logger.Infof("log level changed to %s", level)

	return nil
}

func (s *Service) GetKeepInBackground() bool {
	return config.GetKeepInBackground()
}

func (s *Service) SetKeepInBackground(keep bool) error {
	if err := config.SetKeepInBackground(keep); err != nil {
		logger.Errorf("failed to set keep_in_background: %v", err)
		return err
	}

	logger.Infof("keep_in_background setting changed to %v", keep)
	return nil
}

func (s *Service) ShowWindow() {
	if s.ctx == nil {
		logger.Warn("ShowWindow called but context is nil")
		return
	}

	logger.Info("Showing window...")
	wailsRuntime.WindowShow(s.ctx)
	wailsRuntime.WindowUnminimise(s.ctx)
	logger.Info("Window shown and unminimized")
}

func (s *Service) GetStartHidden() bool {
	return config.GetStartHidden()
}

func (s *Service) SetStartHidden(hidden bool) error {
	if err := config.SetStartHidden(hidden); err != nil {
		logger.Errorf("failed to set start_hidden: %v", err)
		return err
	}

	logger.Infof("start_hidden setting changed to %v", hidden)
	return nil
}
