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
	oplock         *OperationLock // shared with the manual sync path; serializes all git ops

	emitter        toastEmitter
	lastFailureKey string // "" = healthy; guarded by mu. Drives notify() dedup.
	needsPush      bool   // guarded by mu; a local commit failed to push and should be retried
}

func NewSyncManager(db *sql.DB) *SyncManager {
	sm := &SyncManager{
		gitService: NewService(),
		db:         db,
		oplock:     NewOperationLock(),
		reasons:    make([]string, 0),
		done:       make(chan struct{}),
	}

	sm.loadLastCommitTime()

	return sm
}

// SetOperationLock replaces the manager's git operation lock with a shared one
// so the automatic and manual sync paths mutually exclude each other. Called
// once at app startup.
func (sm *SyncManager) SetOperationLock(l *OperationLock) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.oplock = l
}

func (sm *SyncManager) lock() *OperationLock {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.oplock
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

// ReconcileOnStartup schedules a sync if the working tree has uncommitted
// changes at launch — e.g. edits made while the app was closed, or a crash
// mid-session. Without this, such changes sit unsynced until the next in-app
// edit happens to trigger a NotifyChange. Invoked from app startup (not Start)
// so it doesn't run in unit tests that drive the manager directly.
func (sm *SyncManager) ReconcileOnStartup() {
	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled || !gitCfg.AutoCommit {
		return
	}

	release, _, ok := sm.lock().TryAcquire("startup-reconcile")
	if !ok {
		return
	}
	defer release()

	dataDir := config.GetDataDirectory()
	if isRepo, err := sm.gitService.IsRepository(dataDir); err != nil || !isRepo {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	status, err := sm.gitService.GetStatus(ctx, dataDir)
	if err != nil {
		logger.WithError(err).Debug("auto-sync: startup reconcile status check failed")
		return
	}
	if !status.Clean {
		sm.NotifyChange("startup: uncommitted changes on disk")
		logger.Info("auto-sync: uncommitted changes found on startup; scheduled a sync")
		return
	}

	// Clean tree, but a previous session may have committed changes whose push
	// failed. Seed a sync so those commits get published on the next cycle.
	if gitCfg.AutoPush {
		branch := gitCfg.Branch
		if branch == "" {
			if b, err := sm.gitService.GetCurrentBranch(ctx, dataDir); err == nil {
				branch = b
			}
		}
		if branch != "" && sm.hasUnpushedCommits(ctx, dataDir, branch) {
			sm.NotifyChange("startup: unpushed commits")
			logger.Info("auto-sync: unpushed commits found on startup; scheduled a push")
		}
	}
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
	release, holder, ok := sm.lock().TryAcquire("auto-sync")
	if !ok {
		logger.WithField("holder", holder).Debug("auto-sync: another git operation in progress, skipping")
		return
	}
	defer release()

	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled || !gitCfg.AutoCommit {
		return
	}

	if gitCfg.CommitInterval <= 0 {
		return
	}

	sm.mu.Lock()
	hasPending := sm.hasPending
	needsPush := sm.needsPush
	timeSinceLastCommit := time.Since(sm.lastCommitTime)
	commitInterval := time.Duration(gitCfg.CommitInterval) * time.Minute
	reasons := make([]string, len(sm.reasons))
	copy(reasons, sm.reasons)
	sm.mu.Unlock()

	if !hasPending && !needsPush {
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

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if hasPending {
		logger.WithFields(map[string]any{
			"timeSinceLastCommit": timeSinceLastCommit.Round(time.Second),
			"pendingChanges":      len(reasons),
		}).Info("auto-sync: interval passed, performing sync")
		sm.notify(sm.performSync(ctx, reasons))
		return
	}

	// No new changes, but a prior commit's push failed — retry just the push
	// (no staging/commit/backup) so the commit doesn't stay stranded locally.
	logger.Debug("auto-sync: retrying a previously-failed push")
	sm.notify(sm.retryPush(ctx))
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
func (sm *SyncManager) performSync(ctx context.Context, reasons []string) *SyncResult {
	if len(reasons) == 0 {
		return &SyncResult{Status: SyncStatusNoChanges}
	}

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

	// Never stage/commit while a merge/rebase/etc. is unfinished: `git add -A`
	// would mark conflicted files resolved and the commit would bake conflict
	// markers into notes (and push them). Surface it and wait for resolution.
	if op := sm.gitService.InProgressOperation(dataDir); op != "" {
		logger.WithField("operation", op).Warn("auto-sync: unfinished git operation; skipping commit to avoid embedding conflict markers")
		return &SyncResult{
			Status:  SyncStatusConflict,
			Message: "Auto-sync paused: an unresolved " + op + " is in progress in your notes repository. Resolve it (run Sync Now, or use your git tool), then editing will sync again.",
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
		sm.clearPendingState(len(reasons), false)
		// Nothing new to commit — but a previous cycle may have committed and
		// then failed to push. Publish those now instead of waiting for the
		// next edit (which is why a failed push used to strand commits locally).
		if gitCfg.AutoPush && hasRemote && sm.hasUnpushedCommits(ctx, dataDir, branch) {
			st := sm.pushWithRebaseRetry(ctx, dataDir, branch)
			sm.setNeedsPush(st == SyncStatusPushFailed)
			return &SyncResult{Status: st}
		}
		sm.setNeedsPush(false)
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
			sm.clearPendingState(len(reasons), false)
			return &SyncResult{Status: SyncStatusNoChanges}
		}
		logger.WithField("error", err).Warn("auto-sync: git commit failed")
		return &SyncResult{Status: SyncStatusError, Message: commitFailureMessage}
	}

	sm.clearPendingState(len(reasons), true)

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
		sm.setNeedsPush(result.Status == SyncStatusPushFailed)
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

	key := failureKey(result)

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

// failureKey maps a sync outcome to a stable failure identifier used to
// deduplicate notifications. Healthy outcomes map to "". Hard errors include
// the message so a change in the actual failure (e.g. "not a repo" →
// "commit failed") still re-notifies rather than being suppressed as the same.
func failureKey(r *SyncResult) string {
	switch r.Status {
	case SyncStatusConflict:
		return "conflict"
	case SyncStatusPushFailed:
		return "push_failed"
	case SyncStatusError:
		return "error:" + r.Message
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

// clearPendingState removes the `consumed` reasons that this sync cycle
// processed (from the front, FIFO), preserving any reasons appended while the
// sync was running so a change that lands mid-cycle isn't silently dropped.
func (sm *SyncManager) clearPendingState(consumed int, updateCommitTime bool) {
	now := time.Now()
	sm.mu.Lock()
	if consumed >= len(sm.reasons) {
		sm.reasons = make([]string, 0)
	} else {
		sm.reasons = append([]string(nil), sm.reasons[consumed:]...)
	}
	sm.hasPending = len(sm.reasons) > 0
	if updateCommitTime {
		sm.lastCommitTime = now
	}
	sm.mu.Unlock()

	if updateCommitTime {
		sm.saveLastCommitTime(now)
	}
}

// hasUnpushedCommits reports whether the local branch is ahead of its remote
// tracking branch (i.e. there are commits to publish).
func (sm *SyncManager) hasUnpushedCommits(ctx context.Context, dataDir, branch string) bool {
	ab, err := sm.gitService.GetAheadBehind(ctx, dataDir, branch)
	if err != nil {
		return false
	}
	return ab.Ahead > 0
}

func (sm *SyncManager) setNeedsPush(v bool) {
	sm.mu.Lock()
	sm.needsPush = v
	sm.mu.Unlock()
}

// retryPush re-attempts publishing a commit whose push failed earlier, without
// re-running staging/commit/backup. It's the recovery path for a failed push
// when no new edits have arrived (so performSync wouldn't otherwise run).
func (sm *SyncManager) retryPush(ctx context.Context) *SyncResult {
	dataDir := config.GetDataDirectory()
	if isRepo, err := sm.gitService.IsRepository(dataDir); err != nil || !isRepo {
		sm.setNeedsPush(false)
		return &SyncResult{Status: SyncStatusNoChanges}
	}
	if op := sm.gitService.InProgressOperation(dataDir); op != "" {
		return &SyncResult{
			Status:  SyncStatusConflict,
			Message: "Auto-sync paused: an unresolved " + op + " is in progress. Resolve it, then editing will sync again.",
		}
	}

	gitCfg := config.GetGitSyncConfig()
	branch := gitCfg.Branch
	if branch == "" {
		if b, err := sm.gitService.GetCurrentBranch(ctx, dataDir); err == nil {
			branch = b
		} else {
			branch = "master"
		}
	}

	hasRemote, err := sm.gitService.HasRemote(ctx, dataDir, "origin")
	if err != nil {
		hasRemote = false
	}
	if !gitCfg.AutoPush || !hasRemote || !sm.hasUnpushedCommits(ctx, dataDir, branch) {
		// Nothing left to push (pushed elsewhere, auto-push off, or no remote).
		sm.setNeedsPush(false)
		return &SyncResult{Status: SyncStatusNoChanges}
	}

	st := sm.pushWithRebaseRetry(ctx, dataDir, branch)
	sm.setNeedsPush(st == SyncStatusPushFailed)
	return &SyncResult{Status: st}
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
	release, holder, ok := sm.lock().TryAcquire("force-sync")
	if !ok {
		logger.WithField("holder", holder).Debug("force-sync: another git operation in progress, skipping")
		return
	}
	defer release()

	sm.mu.Lock()
	reasons := make([]string, len(sm.reasons))
	copy(reasons, sm.reasons)
	sm.mu.Unlock()

	if len(reasons) > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		sm.notify(sm.performSync(ctx, reasons))
	}
}
