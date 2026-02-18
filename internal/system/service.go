// Package system provides system-level services and coordination.
package system

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
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
	db                       *sql.DB
	dbPath                   string
	eventBus                 *events.EventBus
	shutdownHandler          func()
	hotkeyReconfigureHandler func(config.HotkeyConfig) error
	indexer                  *indexer.Indexer
	gitOpMu                  sync.Mutex
	gitOpInFlight            string
}

const (
	maxFrontendLogFields      = 20
	maxFrontendLogStringChars = 400
	maxFrontendMessageChars   = 2000
	gitTopLevelTimeout        = 95 * time.Second
)

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

func (s *Service) SetHotkeyReconfigureHandler(handler func(config.HotkeyConfig) error) {
	s.hotkeyReconfigureHandler = handler
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
	fields := logger.Log.WithFields(sanitizeFrontendLogData(data))
	message = truncateMessage(message, maxFrontendMessageChars)

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

func truncateMessage(message string, maxChars int) string {
	if len(message) <= maxChars {
		return message
	}
	return fmt.Sprintf("%s...[truncated %d chars]", message[:maxChars], len(message)-maxChars)
}

func sanitizeFrontendLogData(data map[string]any) map[string]any {
	if len(data) == 0 {
		return map[string]any{}
	}

	result := make(map[string]any, 0)
	count := 0
	for key, value := range data {
		if count >= maxFrontendLogFields {
			break
		}
		result[key] = sanitizeFrontendLogValue(value, 0)
		count++
	}

	if omitted := len(data) - count; omitted > 0 {
		result["__omittedFields"] = omitted
	}

	return result
}

func sanitizeFrontendLogValue(value any, depth int) any {
	if value == nil {
		return nil
	}
	if depth > 2 {
		return "[depth-limited]"
	}

	switch v := value.(type) {
	case string:
		return truncateMessage(v, maxFrontendLogStringChars)
	case bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return v
	case error:
		return truncateMessage(v.Error(), maxFrontendLogStringChars)
	case []string:
		limit := 10
		if len(v) < limit {
			limit = len(v)
		}
		out := make([]string, 0, limit+1)
		for i := 0; i < limit; i++ {
			out = append(out, truncateMessage(v[i], maxFrontendLogStringChars))
		}
		if len(v) > limit {
			out = append(out, fmt.Sprintf("[%d more items]", len(v)-limit))
		}
		return out
	case map[string]any:
		return sanitizeFrontendLogData(v)
	default:
		return truncateMessage(fmt.Sprintf("%T", value), maxFrontendLogStringChars)
	}
}

func (s *Service) beginGitOperation(operation string) (func(), error) {
	s.gitOpMu.Lock()
	defer s.gitOpMu.Unlock()

	if s.gitOpInFlight != "" {
		return nil, fmt.Errorf("GIT_OPERATION_IN_PROGRESS:\nAnother git operation is already running (%s).", s.gitOpInFlight)
	}

	s.gitOpInFlight = operation
	released := false
	return func() {
		s.gitOpMu.Lock()
		defer s.gitOpMu.Unlock()
		if released {
			return
		}
		released = true
		s.gitOpInFlight = ""
	}, nil
}

func normalizeGitTimeoutError(ctx context.Context, err error, operation string) error {
	if err == nil {
		return nil
	}

	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("GIT_TIMEOUT:\nGit %s timed out after %s.\n\nTry again or check remote connectivity/authentication.", operation, gitTopLevelTimeout)
	}

	return err
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

// IsDataDirectoryOverridden returns true when YANTA_HOME overrides the
// configured data directory. In that case, changes via the UI won't take
// effect until the env var is unset.
func (s *Service) IsDataDirectoryOverridden(ctx context.Context) bool {
	return config.IsDataDirectoryOverridden()
}

// GetAppHomeEnvVar returns the YANTA_HOME value if set, empty string otherwise.
func (s *Service) GetAppHomeEnvVar(ctx context.Context) string {
	return config.GetAppHomeEnvVar()
}

func (s *Service) OpenDirectoryDialog(ctx context.Context) (string, error) {
	return s.OpenDirectoryDialogWithTitle(ctx, "Select Git Directory")
}

func (s *Service) OpenDirectoryDialogWithTitle(ctx context.Context, title string) (string, error) {
	app := s.eventBus.GetApp()
	if app == nil {
		return "", fmt.Errorf("app not available")
	}
	dialogTitle := strings.TrimSpace(title)
	if dialogTitle == "" {
		dialogTitle = "Select Directory"
	}

	selection, err := app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle(dialogTitle).
		PromptForSingleSelection()
	if err != nil {
		logger.Errorf("failed to open directory dialog: %v", err)
		return "", err
	}

	return selection, nil
}

func (s *Service) OpenFileDialogWithTitle(ctx context.Context, title string) (string, error) {
	app := s.eventBus.GetApp()
	if app == nil {
		return "", fmt.Errorf("app not available")
	}
	dialogTitle := strings.TrimSpace(title)
	if dialogTitle == "" {
		dialogTitle = "Select File"
	}

	selection, err := app.Dialog.OpenFile().
		CanChooseDirectories(false).
		CanChooseFiles(true).
		SetTitle(dialogTitle).
		PromptForSingleSelection()
	if err != nil {
		logger.Errorf("failed to open file dialog: %v", err)
		return "", err
	}

	return selection, nil
}

func (s *Service) ValidateMigrationTarget(ctx context.Context, targetPath string) error {
	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)
	return migrationService.ValidateTargetDirectory(targetPath)
}

// CheckMigrationConflicts detects if both local and target have vault data,
// and returns statistics for both vaults.
func (s *Service) CheckMigrationConflicts(ctx context.Context, targetPath string) (*migration.MigrationConflictInfo, error) {
	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)
	return migrationService.CheckMigrationConflicts(targetPath)
}

func (s *Service) MigrateToGitDirectory(ctx context.Context, targetPath string, strategy migration.MigrationStrategy) error {
	logger.Infof("starting migration to %s with strategy %s", targetPath, strategy)

	gitService := git.NewService()
	migrationService := migration.NewService(s.db, gitService)

	if err := migrationService.MigrateData(targetPath, strategy); err != nil {
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

func (s *Service) SyncNow(ctx context.Context) (*git.SyncResult, error) {
	release, err := s.beginGitOperation("sync")
	if err != nil {
		return nil, err
	}
	defer release()

	ctx, cancel := context.WithTimeout(ctx, gitTopLevelTimeout)
	defer cancel()

	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled {
		return nil, fmt.Errorf("GIT_NOT_ENABLED:\nGit sync is not enabled.\n\nGo to Settings → Git Sync and enable it first.")
	}

	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	logger.Infof("starting git sync in: %s", dataDir)

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil {
		return nil, normalizeGitTimeoutError(ctx, fmt.Errorf("REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s", err, dataDir), "sync")
	}
	if !isRepo {
		return nil, fmt.Errorf(
			"NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	branch, err := gitService.GetCurrentBranch(ctx, dataDir)
	if err != nil {
		logger.WithError(err).Warn("could not determine current branch, defaulting to master")
		branch = "master"
	}
	logger.WithField("branch", branch).Debug("current branch")

	hasRemote, err := gitService.HasRemote(ctx, dataDir, "origin")
	if err != nil {
		logger.WithError(err).Warn("failed to check for remote")
		hasRemote = false
	}

	result := &git.SyncResult{
		Status:  git.SyncStatusNoChanges,
		Message: "No changes to sync",
	}

	if hasRemote {
		logger.Info("fetching from remote")
		if err := gitService.Fetch(ctx, dataDir, "origin"); err != nil {
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, normalizeGitTimeoutError(ctx, err, "sync")
			}
			logger.WithError(err).Warn("fetch failed, continuing with local sync")
		}

		logger.Info("pulling from remote")
		if err := gitService.Pull(ctx, dataDir, "origin", branch); err != nil {
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, normalizeGitTimeoutError(ctx, err, "sync")
			}
			errStr := err.Error()
			if strings.Contains(errStr, "MERGE_CONFLICT") {
				return &git.SyncResult{
					Status:  git.SyncStatusConflict,
					Message: "Merge conflict detected. Please resolve conflicts manually.",
				}, fmt.Errorf("%w", err)
			}
			logger.WithError(err).Warn("pull failed, continuing with local changes")
		} else {
			result.Pulled = true
		}
	}

	logger.Info("staging changes")
	if err := gitService.AddAll(ctx, dataDir); err != nil {
		return nil, normalizeGitTimeoutError(ctx, fmt.Errorf("STAGING_FAILED:\nFailed to stage changes: %v\n\nDirectory: %s", err, dataDir), "sync")
	}

	status, err := gitService.GetStatus(ctx, dataDir)
	if err != nil {
		return nil, normalizeGitTimeoutError(ctx, fmt.Errorf("STATUS_FAILED:\nFailed to read git status: %v\n\nDirectory: %s", err, dataDir), "sync")
	}

	if status.Clean {
		logger.Info("no local changes to commit")
		if result.Pulled {
			result.Status = git.SyncStatusUpToDate
			result.Message = "Already in sync with remote"
		}
		return result, nil
	}

	filesChanged := len(status.Staged) + len(status.Modified) + len(status.Untracked)
	result.FilesChanged = filesChanged

	logger.WithFields(map[string]any{
		"staged":    len(status.Staged),
		"modified":  len(status.Modified),
		"untracked": len(status.Untracked),
		"total":     filesChanged,
	}).Debug("changes to commit")

	logger.Info("committing changes")
	commitMsg := fmt.Sprintf("sync: %d file(s) at %s", filesChanged, time.Now().Format("2006-01-02 15:04:05"))
	if err := gitService.Commit(ctx, dataDir, commitMsg); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, normalizeGitTimeoutError(ctx, err, "sync")
		}
		if strings.Contains(err.Error(), "nothing to commit") {
			logger.Info("nothing to commit after staging")
			result.Status = git.SyncStatusNoChanges
			result.Message = "No changes to sync"
			return result, nil
		}
		return nil, fmt.Errorf("COMMIT_FAILED:\nFailed to commit changes: %v\n\nDirectory: %s", err, dataDir)
	}

	commitHash, _ := gitService.GetLastCommitHash(ctx, dataDir)
	result.CommitHash = commitHash
	result.Status = git.SyncStatusCommitted
	result.Message = fmt.Sprintf("Committed %d file(s)", filesChanged)

	if hasRemote {
		logger.Info("pushing to remote")
		if err := gitService.Push(ctx, dataDir, "origin", branch); err != nil {
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return result, normalizeGitTimeoutError(ctx, err, "sync")
			}
			errStr := err.Error()
			result.Status = git.SyncStatusPushFailed
			result.PushError = errStr
			result.Message = fmt.Sprintf("Committed %d file(s) locally, but push failed", filesChanged)
			logger.WithError(err).Error("push failed after successful commit")
			return result, fmt.Errorf("PUSH_FAILED:\nCommit successful but push failed: %v\n\nYour changes are saved locally.\nTry 'Git Push' again when network is available.", err)
		}

		result.Status = git.SyncStatusSynced
		result.Message = fmt.Sprintf("Synced %d file(s) to remote", filesChanged)
		logger.WithFields(map[string]any{
			"files":  filesChanged,
			"commit": commitHash,
		}).Info("sync completed successfully")
	} else {
		logger.Info("no remote configured, commit saved locally")
		result.Message = fmt.Sprintf("Committed %d file(s) locally (no remote configured)", filesChanged)
	}

	return result, nil
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

	status, err := gitService.GetStatus(ctx, dataDir)
	if err != nil {
		return nil, fmt.Errorf("getting git status: %w", err)
	}

	result := map[string]any{
		"enabled":    true,
		"clean":      status.Clean,
		"modified":   status.Modified,
		"untracked":  status.Untracked,
		"staged":     status.Staged,
		"deleted":    status.Deleted,
		"renamed":    status.Renamed,
		"conflicted": status.Conflicted,
	}

	// Get ahead/behind count if we have a remote
	hasRemote, _ := gitService.HasRemote(ctx, dataDir, "origin")
	if hasRemote {
		branch, err := gitService.GetCurrentBranch(ctx, dataDir)
		if err == nil && branch != "" {
			if ab, err := gitService.GetAheadBehind(ctx, dataDir, branch); err == nil {
				result["ahead"] = ab.Ahead
				result["behind"] = ab.Behind
			}
		}
	}

	return result, nil
}

func (s *Service) GetGitBranches(ctx context.Context) ([]string, error) {
	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil || !isRepo {
		return []string{}, nil
	}

	branches, err := gitService.GetBranches(ctx, dataDir)
	if err != nil {
		return nil, fmt.Errorf("getting git branches: %w", err)
	}

	return branches, nil
}

func (s *Service) GetCurrentGitBranch(ctx context.Context) (string, error) {
	dataDir := config.GetDataDirectory()
	gitService := git.NewService()

	isRepo, err := gitService.IsRepository(dataDir)
	if err != nil || !isRepo {
		return "", nil
	}

	branch, err := gitService.GetCurrentBranch(ctx, dataDir)
	if err != nil {
		return "", fmt.Errorf("getting current branch: %w", err)
	}

	return branch, nil
}

func (s *Service) GitPush(ctx context.Context) error {
	release, err := s.beginGitOperation("push")
	if err != nil {
		return err
	}
	defer release()

	ctx, cancel := context.WithTimeout(ctx, gitTopLevelTimeout)
	defer cancel()

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
		return normalizeGitTimeoutError(ctx, fmt.Errorf(
			"REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s",
			err,
			dataDir,
		), "push")
	}
	if !isRepo {
		return fmt.Errorf(
			"NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	branch, err := gitService.GetCurrentBranch(ctx, dataDir)
	if err != nil {
		logger.WithError(err).Warn("could not determine current branch, defaulting to master")
		branch = "master"
	}

	logger.Info("pushing to remote")
	if err := gitService.Push(ctx, dataDir, "origin", branch); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return normalizeGitTimeoutError(ctx, err, "push")
		}
		errMsg := err.Error()
		if strings.Contains(errMsg, "rejected") && strings.Contains(errMsg, "non-fast-forward") {
			return fmt.Errorf(
				"PUSH_REJECTED:\n%v\n\n⚠️ Your local commits are behind the remote.\n\nYou need to pull first:\n1. Run 'Git Pull' to fetch and merge remote changes\n2. Resolve any conflicts if they occur\n3. Then push again",
				err,
			)
		}
		if strings.Contains(errMsg, "failed to push") || strings.Contains(errMsg, "Connection") {
			return fmt.Errorf(
				"PUSH_FAILED:\n%v\n\nBranch: %s\n\nPossible causes:\n- Network connectivity issues\n- Authentication problems (check SSH keys or credentials)\n- Remote repository doesn't exist or is unreachable",
				err,
				branch,
			)
		}
		return err
	}

	logger.Info("push completed successfully")
	return nil
}

func (s *Service) GitPull(ctx context.Context) error {
	release, err := s.beginGitOperation("pull")
	if err != nil {
		return err
	}
	defer release()

	ctx, cancel := context.WithTimeout(ctx, gitTopLevelTimeout)
	defer cancel()

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
		return normalizeGitTimeoutError(ctx, fmt.Errorf(
			"REPO_CHECK_FAILED:\nFailed to check git repository: %v\n\nDirectory: %s",
			err,
			dataDir,
		), "pull")
	}
	if !isRepo {
		return fmt.Errorf(
			"NOT_A_REPO:\nNot a git repository.\n\nDirectory: %s\n\nMigrate your data to a git directory first (Settings → Git Sync)",
			dataDir,
		)
	}

	branch, err := gitService.GetCurrentBranch(ctx, dataDir)
	if err != nil {
		logger.WithError(err).Warn("could not determine current branch, defaulting to master")
		branch = "master"
	}

	logger.Info("pulling from remote")
	if err := gitService.Pull(ctx, dataDir, "origin", branch); err != nil {
		return normalizeGitTimeoutError(ctx, err, "pull")
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

// GetHotkeyConfig returns the current hotkey configuration.
func (s *Service) GetHotkeyConfig(ctx context.Context) config.HotkeyConfig {
	return config.GetHotkeyConfig()
}

// SetHotkeyConfig updates the hotkey configuration and triggers live reconfiguration.
func (s *Service) SetHotkeyConfig(ctx context.Context, cfg config.HotkeyConfig) error {
	// Validate the configuration
	if cfg.QuickCaptureKey == "" {
		return fmt.Errorf("quick capture key cannot be empty")
	}
	if len(cfg.QuickCaptureModifiers) == 0 {
		return fmt.Errorf("at least one modifier is required")
	}

	// Save to config
	if err := config.SetHotkeyConfig(cfg); err != nil {
		logger.Errorf("failed to save hotkey config: %v", err)
		return err
	}

	// Trigger live reconfiguration if handler is set
	if s.hotkeyReconfigureHandler != nil {
		if err := s.hotkeyReconfigureHandler(cfg); err != nil {
			logger.Errorf("failed to reconfigure hotkeys: %v", err)
			return fmt.Errorf("config saved but hotkey registration failed: %w", err)
		}
	}

	logger.Infof("hotkey config updated: enabled=%v, modifiers=%v, key=%s",
		cfg.QuickCaptureEnabled, cfg.QuickCaptureModifiers, cfg.QuickCaptureKey)
	return nil
}

// GetAvailableHotkeyKeys returns the list of supported keys for hotkey configuration.
func (s *Service) GetAvailableHotkeyKeys(ctx context.Context) []string {
	return []string{
		"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
		"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
		"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
		"F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
		"Space", "Enter", "Escape", "Tab",
	}
}

// GetAvailableHotkeyModifiers returns the list of supported modifiers for hotkey configuration.
func (s *Service) GetAvailableHotkeyModifiers(ctx context.Context) []string {
	return []string{"Ctrl", "Shift", "Alt", "Win"}
}

// GetPlatform returns the current platform name.
func (s *Service) GetPlatform(ctx context.Context) string {
	return runtime.GOOS
}

// GetSidebarVisible returns the current sidebar visibility setting.
func (s *Service) GetSidebarVisible(ctx context.Context) bool {
	return config.GetSidebarVisible()
}

// SetSidebarVisible updates the sidebar visibility setting.
func (s *Service) SetSidebarVisible(ctx context.Context, visible bool) error {
	if err := config.SetSidebarVisible(visible); err != nil {
		logger.Errorf("failed to set sidebar_visible: %v", err)
		return err
	}

	logger.Infof("sidebar_visible setting changed to %v", visible)
	return nil
}

// GetShowFooterHints returns the current footer hints visibility setting.
func (s *Service) GetShowFooterHints(ctx context.Context) bool {
	return config.GetShowFooterHints()
}

// SetShowFooterHints updates the footer hints visibility setting.
func (s *Service) SetShowFooterHints(ctx context.Context, show bool) error {
	if err := config.SetShowFooterHints(show); err != nil {
		logger.Errorf("failed to set show_footer_hints: %v", err)
		return err
	}

	logger.Infof("show_footer_hints setting changed to %v", show)
	return nil
}

// GetShowShortcutTooltips returns the current shortcut tooltips visibility setting.
func (s *Service) GetShowShortcutTooltips(ctx context.Context) bool {
	return config.GetShowShortcutTooltips()
}

// SetShowShortcutTooltips updates the shortcut tooltips visibility setting.
func (s *Service) SetShowShortcutTooltips(ctx context.Context, show bool) error {
	if err := config.SetShowShortcutTooltips(show); err != nil {
		logger.Errorf("failed to set show_shortcut_tooltips: %v", err)
		return err
	}

	logger.Infof("show_shortcut_tooltips setting changed to %v", show)
	return nil
}

// IsCommandLineEnabled returns whether the command line feature is enabled.
// Value is resolved from config.toml [feature_flags].command_line with env override.
func (s *Service) IsCommandLineEnabled(ctx context.Context) bool {
	return config.GetFeatureFlags().CommandLine
}
