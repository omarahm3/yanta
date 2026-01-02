package git

import (
	"database/sql"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"yanta/internal/config"
	"yanta/internal/logger"
)

const (
	kvKeyLastAutoSync = "last_auto_sync"
	tickerInterval    = 1 * time.Minute
)

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
	reasons := sm.reasons
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

	sm.performSync(reasons)
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

func (sm *SyncManager) performSync(reasons []string) {
	if len(reasons) == 0 {
		return
	}

	dataDir := config.GetDataDirectory()

	isRepo, err := sm.gitService.IsRepository(dataDir)
	if err != nil || !isRepo {
		logger.WithFields(map[string]any{
			"dataDir": dataDir,
			"error":   err,
		}).Debug("auto-sync: skipping - not a git repository")
		return
	}

	branch, err := sm.gitService.GetCurrentBranch(dataDir)
	if err != nil {
		logger.WithError(err).Debug("auto-sync: could not determine branch, using master")
		branch = "master"
	}

	hasRemote, _ := sm.gitService.HasRemote(dataDir, "origin")

	if hasRemote {
		if err := sm.gitService.Fetch(dataDir, "origin"); err != nil {
			logger.WithField("error", err).Debug("auto-sync: fetch failed, continuing")
		}
	}

	if err := sm.gitService.AddAll(dataDir); err != nil {
		logger.WithField("error", err).Warn("auto-sync: git add failed")
		return
	}

	status, err := sm.gitService.GetStatus(dataDir)
	if err != nil {
		logger.WithField("error", err).Warn("auto-sync: failed to read git status after staging")
		return
	}

	if status.Clean {
		logger.Debug("auto-sync: git status clean after staging; skipping commit")
		sm.clearPendingState(false)
		return
	}

	filesChanged := len(status.Staged) + len(status.Modified) + len(status.Untracked)
	logger.WithFields(map[string]any{
		"modified":  len(status.Modified),
		"untracked": len(status.Untracked),
		"staged":    len(status.Staged),
		"total":     filesChanged,
	}).Debug("auto-sync: git status after staging")

	commitMsg := sm.buildCommitMessage(reasons)
	if err := sm.gitService.Commit(dataDir, commitMsg); err != nil {
		if err.Error() == "nothing to commit" {
			logger.Debug("auto-sync: nothing to commit")
			sm.clearPendingState(false)
			return
		}
		logger.WithField("error", err).Warn("auto-sync: git commit failed")
		return
	}

	sm.clearPendingState(true)

	commitHash, _ := sm.gitService.GetLastCommitHash(dataDir)
	logger.WithFields(map[string]any{
		"operations": len(reasons),
		"files":      filesChanged,
		"commit":     commitHash,
		"message":    commitMsg,
	}).Info("auto-sync: committed successfully")

	gitCfg := config.GetGitSyncConfig()
	if gitCfg.AutoPush && hasRemote {
		logger.Debug("auto-sync: pushing to remote")
		if err := sm.gitService.Push(dataDir, "origin", branch); err != nil {
			logger.WithField("error", err).Warn("auto-sync: push failed (commit was successful locally)")
		} else {
			logger.WithFields(map[string]any{
				"time":   time.Now().Format("15:04:05"),
				"branch": branch,
			}).Info("auto-sync: pushed to remote successfully")
		}
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
	sm.mu.Lock()
	reasons := sm.reasons
	sm.mu.Unlock()

	if len(reasons) > 0 {
		sm.performSync(reasons)
	}
}
