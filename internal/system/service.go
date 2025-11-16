package system

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"
	"yanta/internal/config"
	"yanta/internal/git"
	"yanta/internal/logger"
	"yanta/internal/migration"

	"github.com/sirupsen/logrus"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	BuildVersion = "dev"
	BuildCommit  = ""
	BuildDate    = ""
)

type Service struct {
	db              *sql.DB
	dbPath          string
	ctx             context.Context
	shutdownHandler func(context.Context)
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

func (s *Service) SetShutdownHandler(handler func(context.Context)) {
	s.shutdownHandler = handler
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

func (s *Service) CheckGitInstalled() (bool, error) {
	gitService := git.NewService()
	return gitService.CheckInstalled()
}

func (s *Service) GetCurrentDataDirectory() string {
	return config.GetDataDirectory()
}

func (s *Service) OpenDirectoryDialog() (string, error) {
	if s.ctx == nil {
		return "", fmt.Errorf("context not set")
	}

	selection, err := wailsRuntime.OpenDirectoryDialog(s.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Git Directory",
	})
	if err != nil {
		logger.Errorf("failed to open directory dialog: %v", err)
		return "", err
	}

	return selection, nil
}

func (s *Service) ValidateMigrationTarget(targetPath string) error {
	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)
	return migrationService.ValidateTargetDirectory(targetPath)
}

func (s *Service) MigrateToGitDirectory(targetPath string) error {
	logger.Infof("starting migration to %s", targetPath)

	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)

	if err := migrationService.MigrateData(targetPath); err != nil {
		logger.Errorf("migration failed: %v", err)
		return err
	}

	logger.Info("migration completed successfully - app will exit")

	go func() {
		time.Sleep(2 * time.Second)

		if s.shutdownHandler != nil {
			logger.Info("calling shutdown handler for cleanup")
			s.shutdownHandler(context.Background())
		}

		logger.Info("forcing app exit after migration (ignoring background mode)")
		os.Exit(0)
	}()

	return nil
}

func (s *Service) GetGitSyncConfig() config.GitSyncConfig {
	return config.GetGitSyncConfig()
}

func (s *Service) SetGitSyncConfig(cfg config.GitSyncConfig) error {
	return config.SetGitSyncConfig(cfg)
}

func (s *Service) SyncNow() error {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return fmt.Errorf("git sync is not enabled. Enable it in Settings")
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting manual git sync in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return fmt.Errorf("failed to check git repository:\n%w\n\nDirectory: %s", err, dataDir)
	}
	if !isRepo {
		return fmt.Errorf("not a git repository\n\nDirectory: %s\nHint: Migrate your data to a git directory first (Settings → Git Sync)", dataDir)
	}

	logger.Debug("staging changes with git add -A")
	if err := gitService.AddAll(dataDir); err != nil {
		return fmt.Errorf("failed to stage changes:\n%w\n\nDirectory: %s", err, dataDir)
	}

	logger.Debug("committing changes")
	commitMsg := fmt.Sprintf("sync: manual sync at %s", time.Now().Format("2006-01-02 15:04:05"))
	if err := gitService.Commit(dataDir, commitMsg); err != nil {
		if err.Error() == "nothing to commit" {
			logger.Info("no changes to sync")
			return nil
		}
		return fmt.Errorf("failed to commit changes:\n%w\n\nDirectory: %s", err, dataDir)
	}

	if gitCfg.AutoPush {
		logger.Info("pushing to remote")
		if err := gitService.Push(dataDir, "origin", "master"); err != nil {
			return fmt.Errorf("failed to push to remote:\n%w\n\nBranch: master\nHint: Check network connection and authentication", err)
		}
	}

	logger.Info("sync completed successfully")
	return nil
}

func (s *Service) GetGitStatus() (map[string]any, error) {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return map[string]any{
			"enabled": false,
		}, nil
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	status, err := gitService.GetStatus(dataDir)
	if err != nil {
		return nil, fmt.Errorf("getting git status: %w", err)
	}

	return map[string]any{
		"enabled":   true,
		"clean":     status.Clean,
		"modified":  status.Modified,
		"untracked": status.Untracked,
		"staged":    status.Staged,
	}, nil
}

func (s *Service) GitPush() error {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return fmt.Errorf("GIT_NOT_ENABLED:\nGit sync is not enabled.\n\nGo to Settings → Git Sync and enable it first.")
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting manual git push in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return fmt.Errorf("REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s", err, dataDir)
	}
	if !isRepo {
		return fmt.Errorf("NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)", dataDir)
	}

	logger.Info("pushing to remote")
	if err := gitService.Push(dataDir, "origin", "master"); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "rejected") && strings.Contains(errMsg, "non-fast-forward") {
			return fmt.Errorf("PUSH_REJECTED:\n%v\n\n⚠️ Your local commits are behind the remote.\n\nYou need to pull first:\n1. Run 'Git Pull' to fetch and merge remote changes\n2. Resolve any conflicts if they occur\n3. Then push again", err)
		}
		if strings.Contains(errMsg, "failed to push") || strings.Contains(errMsg, "Connection") {
			return fmt.Errorf("PUSH_FAILED:\n%v\n\nBranch: master\n\nPossible causes:\n- Network connectivity issues\n- Authentication problems (check SSH keys or credentials)\n- Remote repository doesn't exist or is unreachable", err)
		}
		return err
	}

	logger.Info("push completed successfully")
	return nil
}

func (s *Service) GitPull() error {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return fmt.Errorf("GIT_NOT_ENABLED:\nGit sync is not enabled.\n\nGo to Settings → Git Sync and enable it first.")
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting manual git pull in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return fmt.Errorf("REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s", err, dataDir)
	}
	if !isRepo {
		return fmt.Errorf("NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)", dataDir)
	}

	logger.Info("pulling from remote")
	if err := gitService.Pull(dataDir, "origin", "master"); err != nil {
		return err
	}

	logger.Info("pull completed successfully")
	return nil
}

func (s *Service) Quit() {
	if s.ctx == nil {
		logger.Warn("Quit called but context is nil")
		return
	}

	logger.Info("Quit requested from frontend")
	wailsRuntime.Quit(s.ctx)
}

func (s *Service) BackgroundQuit() {
	if s.ctx == nil {
		logger.Warn("BackgroundQuit called but context is nil")
		return
	}

	keepInBackground := config.GetKeepInBackground()
	logger.Infof("BackgroundQuit requested (keepInBackground=%v)", keepInBackground)

	if keepInBackground {
		logger.Info("Hiding window (background mode enabled)")
		wailsRuntime.WindowHide(s.ctx)
		wailsRuntime.EventsEmit(s.ctx, "WindowHidden")
	} else {
		logger.Info("Quitting application (background mode disabled)")
		wailsRuntime.Quit(s.ctx)
	}
}

func (s *Service) ForceQuit() {
	if s.ctx == nil {
		logger.Warn("ForceQuit called but context is nil")
		return
	}

	logger.Info("ForceQuit requested - quitting application regardless of background setting")
	wailsRuntime.Quit(s.ctx)
}
