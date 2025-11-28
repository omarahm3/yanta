package system

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"yanta/internal/config"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/indexer"
	"yanta/internal/logger"
	"yanta/internal/migration"
)

var (
	BuildVersion = "dev"
	BuildCommit  = ""
	BuildDate    = ""
)

type Service struct {
	db              *sql.DB
	dbPath          string
	eventBus        *events.EventBus
	shutdownHandler func()
	indexer         *indexer.Indexer
}

func NewService(db *sql.DB, eventBus *events.EventBus) *Service {
	return &Service{
		db:       db,
		dbPath:   "",
		eventBus: eventBus,
	}
}

func (s *Service) SetDBPath(path string) {
	s.dbPath = path
}

func (s *Service) SetShutdownHandler(handler func()) {
	s.shutdownHandler = handler
}

func (s *Service) SetIndexer(idx *indexer.Indexer) {
	s.indexer = idx
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

func (s *Service) GetSystemInfo(ctx context.Context) (*SystemInfo, error) {
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

func (s *Service) LogFromFrontend(
	ctx context.Context,
	level string,
	message string,
	data map[string]any,
) {
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

func (s *Service) SetLogLevel(ctx context.Context, level string) error {
	if err := config.SetLogLevel(level); err != nil {
		return err
	}

	parsedLevel, _ := logrus.ParseLevel(level)
	logger.GetLogger().SetLevel(parsedLevel)
	logger.Infof("log level changed to %s", level)

	return nil
}

func (s *Service) GetKeepInBackground(ctx context.Context) bool {
	return config.GetKeepInBackground()
}

func (s *Service) SetKeepInBackground(ctx context.Context, keep bool) error {
	if err := config.SetKeepInBackground(keep); err != nil {
		logger.Errorf("failed to set keep_in_background: %v", err)
		return err
	}

	logger.Infof("keep_in_background setting changed to %v", keep)
	return nil
}

func (s *Service) ShowWindow(ctx context.Context) {
	window := s.eventBus.GetWindow()
	if window == nil {
		logger.Warn("ShowWindow called but window is nil")
		return
	}

	logger.Info("Showing window...")
	window.Show()
	window.Restore()
	logger.Info("Window shown and unminimized")
}

func (s *Service) GetStartHidden(ctx context.Context) bool {
	return config.GetStartHidden()
}

func (s *Service) SetStartHidden(ctx context.Context, hidden bool) error {
	if err := config.SetStartHidden(hidden); err != nil {
		logger.Errorf("failed to set start_hidden: %v", err)
		return err
	}

	logger.Infof("start_hidden setting changed to %v", hidden)
	return nil
}

func (s *Service) CheckGitInstalled(ctx context.Context) (bool, error) {
	gitService := git.NewService()
	return gitService.CheckInstalled()
}

func (s *Service) GetCurrentDataDirectory(ctx context.Context) string {
	return config.GetDataDirectory()
}

func (s *Service) OpenDirectoryDialog(ctx context.Context) (string, error) {
	app := s.eventBus.GetApp()
	if app == nil {
		return "", fmt.Errorf("app not available")
	}

	selection, err := app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle("Select Git Directory").
		PromptForSingleSelection()
	if err != nil {
		logger.Errorf("failed to open directory dialog: %v", err)
		return "", err
	}

	return selection, nil
}

func (s *Service) ValidateMigrationTarget(ctx context.Context, targetPath string) error {
	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)
	return migrationService.ValidateTargetDirectory(targetPath)
}

func (s *Service) MigrateToGitDirectory(ctx context.Context, targetPath string) error {
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
			s.shutdownHandler()
		}

		logger.Info("forcing app exit after migration (ignoring background mode)")
		os.Exit(0)
	}()

	return nil
}

func (s *Service) GetGitSyncConfig(ctx context.Context) config.GitSyncConfig {
	return config.GetGitSyncConfig()
}

func (s *Service) SetGitSyncConfig(ctx context.Context, cfg config.GitSyncConfig) error {
	return config.SetGitSyncConfig(cfg)
}

func (s *Service) SyncNow(ctx context.Context) error {
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
		return fmt.Errorf(
			"not a git repository\n\nDirectory: %s\nHint: Migrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	logger.Info("staging changes")
	if err := gitService.AddAll(dataDir); err != nil {
		return fmt.Errorf("failed to stage changes:\n%w\n\nDirectory: %s", err, dataDir)
	}

	status, err := gitService.GetStatus(dataDir)
	if err != nil {
		return fmt.Errorf("failed to read git status after staging:\n%w\n\nDirectory: %s", err, dataDir)
	}

	if status.Clean {
		logger.Info("no changes to sync (git status clean after staging)")
		return nil
	}

	logger.WithFields(map[string]any{
		"modified":  status.Modified,
		"untracked": status.Untracked,
		"staged":    status.Staged,
	}).Debug("git status after staging")

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
			return fmt.Errorf(
				"failed to push to remote:\n%w\n\nBranch: master\nHint: Check network connection and authentication",
				err,
			)
		}
	}

	logger.Info("sync completed successfully")
	return nil
}

func (s *Service) GetGitStatus(ctx context.Context) (map[string]any, error) {
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

func (s *Service) GitPush(ctx context.Context) error {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return fmt.Errorf(
			"GIT_NOT_ENABLED:\nGit sync is not enabled.\n\nGo to Settings → Git Sync and enable it first.",
		)
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting manual git push in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return fmt.Errorf(
			"REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s",
			err,
			dataDir,
		)
	}
	if !isRepo {
		return fmt.Errorf(
			"NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	logger.Info("pushing to remote")
	if err := gitService.Push(dataDir, "origin", "master"); err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "rejected") && strings.Contains(errMsg, "non-fast-forward") {
			return fmt.Errorf(
				"PUSH_REJECTED:\n%v\n\n⚠️ Your local commits are behind the remote.\n\nYou need to pull first:\n1. Run 'Git Pull' to fetch and merge remote changes\n2. Resolve any conflicts if they occur\n3. Then push again",
				err,
			)
		}
		if strings.Contains(errMsg, "failed to push") || strings.Contains(errMsg, "Connection") {
			return fmt.Errorf(
				"PUSH_FAILED:\n%v\n\nBranch: master\n\nPossible causes:\n- Network connectivity issues\n- Authentication problems (check SSH keys or credentials)\n- Remote repository doesn't exist or is unreachable",
				err,
			)
		}
		return err
	}

	logger.Info("push completed successfully")
	return nil
}

func (s *Service) GitPull(ctx context.Context) error {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return fmt.Errorf(
			"GIT_NOT_ENABLED:\nGit sync is not enabled.\n\nGo to Settings → Git Sync and enable it first.",
		)
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting manual git pull in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return fmt.Errorf(
			"REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s",
			err,
			dataDir,
		)
	}
	if !isRepo {
		return fmt.Errorf(
			"NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	logger.Info("pulling from remote")
	if err := gitService.Pull(dataDir, "origin", "master"); err != nil {
		return err
	}

	logger.Info("pull completed successfully")
	return nil
}

func (s *Service) Quit(ctx context.Context) {
	logger.Info("Quit requested from frontend")
	s.eventBus.Emit("app:quit", nil)
}

func (s *Service) BackgroundQuit(ctx context.Context) {
	window := s.eventBus.GetWindow()
	if window == nil {
		logger.Warn("BackgroundQuit called but window is nil")
		return
	}

	keepInBackground := config.GetKeepInBackground()
	logger.Infof("BackgroundQuit requested (keepInBackground=%v)", keepInBackground)

	if keepInBackground {
		logger.Info("Hiding window (background mode enabled)")
		window.Hide()
		s.eventBus.Emit("WindowHidden", nil)
	} else {
		logger.Info("Quitting application (background mode disabled)")
		s.eventBus.Emit("app:quit", nil)
	}
}

func (s *Service) ForceQuit(ctx context.Context) {
	logger.Info("ForceQuit requested - quitting application regardless of background setting")
	s.eventBus.Emit("app:force-quit", nil)
}

func (s *Service) ReindexDatabase(ctx context.Context) error {
	if s.indexer == nil {
		return fmt.Errorf("indexer not available")
	}

	logger.Info("starting database reindex")
	s.emitProgress(0, 0, "Clearing index...")

	if err := s.indexer.ClearIndex(ctx); err != nil {
		logger.Errorf("failed to clear index: %v", err)
		return fmt.Errorf("failed to clear index: %w", err)
	}

	logger.Info("index cleared, scanning vault")
	s.emitProgress(0, 0, "Scanning vault...")

	if err := s.indexer.ScanAndIndexVault(ctx); err != nil {
		logger.Errorf("failed to scan and index vault: %v", err)
		return fmt.Errorf("failed to scan and index vault: %w", err)
	}

	logger.Info("database reindex completed successfully")
	s.emitProgress(100, 100, "Complete")
	return nil
}

func (s *Service) emitProgress(current, total int, message string) {
	if s.eventBus != nil {
		s.eventBus.Emit("reindex:progress", map[string]interface{}{
			"current": current,
			"total":   total,
			"message": message,
		})
	}
}

func (s *Service) GetAppScale(ctx context.Context) float64 {
	return config.GetAppScale()
}

func (s *Service) SetAppScale(ctx context.Context, scale float64) error {
	if err := config.SetAppScale(scale); err != nil {
		logger.Errorf("failed to set app scale: %v", err)
		return err
	}

	logger.Infof("app scale changed to %v", scale)
	return nil
}
