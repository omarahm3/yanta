package git

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"yanta/internal/backup"
	"yanta/internal/config"
	"yanta/internal/logger"
)

const (
	kvKeyLastAutoSync = "last_auto_sync"
	tickerInterval    = 1 * time.Minute
)

// toastEmitter surfaces auto-sync outcomes to the UI as toasts. It is kept as
// a narrow interface (rather than depending on the events/Wails packages
// directly) so the git package stays free of GUI dependencies, tests can
// capture emissions without a live runtime, and a nil emitter (the default in
// tests) is a safe no-op. The app layer supplies an adapter over the event bus.
type toastEmitter interface {
	EmitToast(kind, message string, durationMs int)
}

type SyncManager struct {
	gitService     *Service
	db             *sql.DB
	mu             sync.Mutex
	reasons        []string
	hasPending     bool
	lastCommitTime time.Time
	ticker         *time.Ticker
	done           chan struct{}
	closed         atomic.Bool
	syncing        atomic.Bool // prevents concurrent sync operations

	emitter        toastEmitter
	lastFailureKey string // "" = healthy; guarded by mu. Drives notify() dedup.
}

func NewSyncManager(db *sql.DB) *SyncManager {
	sm := &SyncManager{
		gitService: NewService(),
		db:         db,
		reasons:    make([]string, 0),
		done:       make(chan struct{}),
	}

	sm.loadLastCommitTime()

	return sm
}

// SetEmitter wires an event emitter so auto-sync can surface failures to the
// user. Called once during app startup; when unset (e.g. in tests) auto-sync
// runs silently.
func (sm *SyncManager) SetEmitter(e toastEmitter) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.emitter = e
}

func (sm *SyncManager) Start() {
	sm.ticker = time.NewTicker(tickerInterval)
	go sm.runLoop()
	logger.Debug("sync manager started with timer-based auto-commit")
}

func (sm *SyncManager) runLoop() {
	for {
		select {
		case <-sm.done:
			logger.Debug("sync manager loop stopped")
			return
		case <-sm.ticker.C:
			sm.checkAndSync()
		}
	}
}

func (sm *SyncManager) checkAndSync() {
	if !sm.syncing.CompareAndSwap(false, true) {
		logger.Debug("auto-sync: sync already in progress, skipping")
		return
	}
	defer sm.syncing.Store(false)

	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled || !gitCfg.AutoCommit {
		return
	}

	if gitCfg.CommitInterval <= 0 {
		return
	}

	sm.mu.Lock()
	hasPending := sm.hasPending
	timeSinceLastCommit := time.Since(sm.lastCommitTime)
	commitInterval := time.Duration(gitCfg.CommitInterval) * time.Minute
	reasons := make([]string, len(sm.reasons))
	copy(reasons, sm.reasons)
	sm.mu.Unlock()

	if !hasPending {
		return
	}

	if timeSinceLastCommit < commitInterval {
		logger.WithFields(map[string]any{
			"timeSinceLastCommit": timeSinceLastCommit.Round(time.Second),
			"commitInterval":      commitInterval,
			"pendingChanges":      len(reasons),
		}).Debug("auto-sync: waiting for interval to pass")
		return
	}

	logger.WithFields(map[string]any{
		"timeSinceLastCommit": timeSinceLastCommit.Round(time.Second),
		"pendingChanges":      len(reasons),
	}).Info("auto-sync: interval passed, performing sync")

	sm.notify(sm.performSync(reasons))
}

// NotifyChange records that a change has occurred that should be synced.
// The actual sync will happen when the commit interval passes.
func (sm *SyncManager) NotifyChange(reason string) {
	if sm.closed.Load() {
		return
	}

	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled || !gitCfg.AutoCommit {
		return
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.reasons = append(sm.reasons, reason)
	sm.hasPending = true

	logger.WithFields(map[string]any{
		"reason":         reason,
		"pendingChanges": len(sm.reasons),
	}).Debug("auto-sync: change recorded")
}

// performSync runs one auto-sync cycle and returns the outcome so the caller
// can decide whether to notify the user. It never emits toasts itself; that is
// notify()'s job. A nil-safe *SyncResult is always returned.
func (sm *SyncManager) performSync(reasons []string) *SyncResult {
	if len(reasons) == 0 {
		return &SyncResult{Status: SyncStatusNoChanges}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	dataDir := config.GetDataDirectory()

	isRepo, err := sm.gitService.IsRepository(dataDir)
	if err != nil || !isRepo {
		logger.WithFields(map[string]any{
			"dataDir": dataDir,
			"error":   err,
		}).Warn("auto-sync: data directory is not a git repository")
		return &SyncResult{
			Status:  SyncStatusError,
			Message: "Auto-sync is enabled, but your notes directory isn't a Git repository. Set it up in Settings → Git Sync.",
		}
	}

	gitCfg := config.GetGitSyncConfig()
	branch := gitCfg.Branch
	if branch == "" {
		var err error
		branch, err = sm.gitService.GetCurrentBranch(ctx, dataDir)
		if err != nil {
			logger.WithError(err).Debug("auto-sync: could not determine branch, using master")
			branch = "master"
		}
	}

	hasRemote, err := sm.gitService.HasRemote(ctx, dataDir, "origin")
	if err != nil {
		logger.WithError(err).Debug("auto-sync: failed to check remote, assuming none")
		hasRemote = false
	}

	if hasRemote {
		if err := sm.gitService.Fetch(ctx, dataDir, "origin"); err != nil {
			logger.WithField("error", err).Debug("auto-sync: fetch failed, continuing")
		}
	}

	backupCfg := config.GetBackupConfig()
	if backupCfg.Enabled {
		logger.Debug("auto-sync: creating pre-sync backup")
		backupService := backup.NewService()
		if err := backupService.CreateBackup(dataDir); err != nil {
			logger.WithField("error", err).Warn("auto-sync: backup creation failed, continuing with sync")
		} else {
			logger.Info("auto-sync: pre-sync backup created successfully")
			if err := backupService.PruneOldBackups(dataDir, backupCfg.MaxBackups); err != nil {
				logger.WithField("error", err).Warn("auto-sync: failed to prune old backups")
			}
		}
	}

	if err := sm.gitService.AddAll(ctx, dataDir); err != nil {
		logger.WithField("error", err).Warn("auto-sync: git add failed")
		return &SyncResult{Status: SyncStatusError, Message: commitFailureMessage}
	}

	status, err := sm.gitService.GetStatus(ctx, dataDir)
	if err != nil {
		logger.WithField("error", err).Warn("auto-sync: failed to read git status after staging")
		return &SyncResult{Status: SyncStatusError, Message: commitFailureMessage}
	}

	if status.Clean {
		logger.Debug("auto-sync: git status clean after staging; skipping commit")
		sm.clearPendingState(false)
		return &SyncResult{Status: SyncStatusNoChanges}
	}

	filesChanged := len(status.Staged) + len(status.Modified) + len(status.Untracked)
	logger.WithFields(map[string]any{
		"modified":  len(status.Modified),
		"untracked": len(status.Untracked),
		"staged":    len(status.Staged),
		"total":     filesChanged,
	}).Debug("auto-sync: git status after staging")

	commitMsg := sm.buildCommitMessage(reasons)
	if err := sm.gitService.Commit(ctx, dataDir, commitMsg); err != nil {
		if err.Error() == "nothing to commit" {
			logger.Debug("auto-sync: nothing to commit")
			sm.clearPendingState(false)
			return &SyncResult{Status: SyncStatusNoChanges}
		}
		logger.WithField("error", err).Warn("auto-sync: git commit failed")
		return &SyncResult{Status: SyncStatusError, Message: commitFailureMessage}
	}

	sm.clearPendingState(true)

	commitHash, _ := sm.gitService.GetLastCommitHash(ctx, dataDir)
	logger.WithFields(map[string]any{
		"operations": len(reasons),
		"files":      filesChanged,
		"commit":     commitHash,
		"message":    commitMsg,
	}).Info("auto-sync: committed successfully")

	result := &SyncResult{
		Status:       SyncStatusCommitted,
		FilesChanged: filesChanged,
		CommitHash:   commitHash,
	}

	if gitCfg.AutoPush && hasRemote {
		result.Status = sm.pushWithRebaseRetry(ctx, dataDir, branch)
	}

	return result
}

// commitFailureMessage is shown when auto-sync can't record changes to Git at
// all (staging, status, or commit failed). It reassures the user their notes
// are still on disk.
const commitFailureMessage = "Auto-sync couldn't save your changes to Git (see logs). Your notes are safe on disk."

// pushWithRebaseRetry pushes and, if the remote is ahead (non-fast-forward),
// runs `git pull --rebase` and retries the push exactly once. It returns the
// resulting status: SyncStatusSynced on success, SyncStatusConflict when a
// rebase conflict needs manual resolution (the rebase is aborted, leaving the
// working tree clean), or SyncStatusPushFailed for any other push failure. In
// every failure case the local commit is intact.
func (sm *SyncManager) pushWithRebaseRetry(ctx context.Context, dataDir, branch string) SyncStatus {
	logger.Debug("auto-sync: pushing to remote")
	err := sm.gitService.Push(ctx, dataDir, "origin", branch)
	if err == nil {
		logger.WithFields(map[string]any{
			"time":   time.Now().Format("15:04:05"),
			"branch": branch,
		}).Info("auto-sync: pushed to remote successfully")
		return SyncStatusSynced
	}

	if !errors.Is(err, ErrNonFastForward) {
		logger.WithField("error", err).Warn("auto-sync: push failed (commit was successful locally)")
		return SyncStatusPushFailed
	}

	logger.WithField("branch", branch).Info("auto-sync: push rejected (remote ahead); attempting pull --rebase")
	if rebaseErr := sm.gitService.PullRebase(ctx, dataDir, "origin", branch); rebaseErr != nil {
		if strings.HasPrefix(rebaseErr.Error(), "REBASE_CONFLICT:") {
			logger.WithField("error", rebaseErr).Warn("auto-sync: rebase conflict; manual resolution required (local commit intact)")
			return SyncStatusConflict
		}
		logger.WithField("error", rebaseErr).Warn("auto-sync: pull --rebase failed; push not retried (local commit intact)")
		return SyncStatusPushFailed
	}

	logger.Debug("auto-sync: rebase succeeded; retrying push")
	if err := sm.gitService.Push(ctx, dataDir, "origin", branch); err != nil {
		logger.WithField("error", err).Warn("auto-sync: push failed after rebase (commit was successful locally)")
		return SyncStatusPushFailed
	}
	logger.WithFields(map[string]any{
		"time":   time.Now().Format("15:04:05"),
		"branch": branch,
	}).Info("auto-sync: pushed to remote successfully (after rebase)")
	return SyncStatusSynced
}

// notify surfaces an auto-sync outcome to the user via a toast, but only when
// the failure state changes — so a healthy repo never spams a toast on every
// interval, and a persistent failure is reported once (not every tick).
// Recovering from a prior failure emits a single success toast.
func (sm *SyncManager) notify(result *SyncResult) {
	if result == nil {
		return
	}

	key := failureKey(result.Status)

	sm.mu.Lock()
	prev := sm.lastFailureKey
	sm.lastFailureKey = key
	emitter := sm.emitter
	sm.mu.Unlock()

	if emitter == nil || key == prev {
		return // nothing wired up, or no change in state → stay quiet
	}

	if key == "" {
		// We were failing before and now we're healthy again.
		emitter.EmitToast("success", "Auto-sync recovered — your notes are syncing again.", 6000)
		return
	}

	switch result.Status {
	case SyncStatusConflict:
		emitter.EmitToast("error",
			"Auto-sync paused: a merge conflict needs manual resolution. Open Settings → Git Sync (or run Sync Now) to resolve it.",
			12000)
	case SyncStatusPushFailed:
		emitter.EmitToast("warning",
			"Auto-sync: your changes were committed locally but couldn't be pushed to the remote (check your connection or credentials). Your notes are safe locally.",
			10000)
	default: // SyncStatusError
		msg := result.Message
		if msg == "" {
			msg = "Auto-sync failed. See logs for details."
		}
		emitter.EmitToast("error", msg, 10000)
	}
}

// failureKey maps a sync status to a stable failure identifier used to
// deduplicate notifications. Healthy outcomes map to "".
func failureKey(s SyncStatus) string {
	switch s {
	case SyncStatusConflict:
		return "conflict"
	case SyncStatusPushFailed:
		return "push_failed"
	case SyncStatusError:
		return "error"
	default:
		return ""
	}
}

func (sm *SyncManager) buildCommitMessage(reasons []string) string {
	if len(reasons) == 1 {
		return fmt.Sprintf("auto: %s", reasons[0])
	}

	return fmt.Sprintf("auto: %d changes", len(reasons))
}

func (sm *SyncManager) clearPendingState(updateCommitTime bool) {
	now := time.Now()
	sm.mu.Lock()
	sm.reasons = make([]string, 0)
	sm.hasPending = false
	if updateCommitTime {
		sm.lastCommitTime = now
	}
	sm.mu.Unlock()

	if updateCommitTime {
		sm.saveLastCommitTime(now)
	}
}

// loadLastCommitTime loads the last auto-sync timestamp from the database
func (sm *SyncManager) loadLastCommitTime() {
	var value string
	err := sm.db.QueryRow("SELECT value FROM kv WHERE key = ?", kvKeyLastAutoSync).Scan(&value)
	if err != nil {
		if err != sql.ErrNoRows {
			logger.WithError(err).Debug("auto-sync: failed to load last commit time")
		}
		return
	}

	if value == "" {
		return
	}

	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		logger.WithError(err).Debug("auto-sync: failed to parse last commit time")
		return
	}

	sm.lastCommitTime = t.Local()
	logger.WithField("lastCommitTime", t.Format("2006-01-02 15:04:05")).Debug("auto-sync: loaded last commit time")
}

func (sm *SyncManager) saveLastCommitTime(t time.Time) {
	value := t.UTC().Format(time.RFC3339)
	_, err := sm.db.Exec(
		"INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
		kvKeyLastAutoSync,
		value,
	)
	if err != nil {
		logger.WithError(err).Warn("auto-sync: failed to save last commit time")
	}
}

func (sm *SyncManager) Shutdown() {
	if !sm.closed.CompareAndSwap(false, true) {
		return
	}

	if sm.ticker != nil {
		sm.ticker.Stop()
	}

	close(sm.done)

	sm.mu.Lock()
	pendingCount := len(sm.reasons)
	sm.mu.Unlock()

	if pendingCount > 0 {
		logger.WithField("pendingChanges", pendingCount).Debug(
			"auto-sync: shutdown with pending changes (will sync on next startup)",
		)
	}
}

func (sm *SyncManager) GetPendingChangesCount() int {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return len(sm.reasons)
}

func (sm *SyncManager) HasPendingChanges() bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.hasPending
}

func (sm *SyncManager) ForceSync() {
	if !sm.syncing.CompareAndSwap(false, true) {
		logger.Debug("force-sync: sync already in progress, skipping")
		return
	}
	defer sm.syncing.Store(false)

	sm.mu.Lock()
	reasons := make([]string, len(sm.reasons))
	copy(reasons, sm.reasons)
	sm.mu.Unlock()

	if len(reasons) > 0 {
		sm.notify(sm.performSync(reasons))
	}
}
