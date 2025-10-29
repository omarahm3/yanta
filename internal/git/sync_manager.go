package git

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"yanta/internal/config"
	"yanta/internal/logger"
)

type SyncManager struct {
	gitService *Service
	queue      chan string
	mu         sync.Mutex
	reasons    []string
	timer      *time.Timer
	debounce   time.Duration
	closed     atomic.Bool
}

func NewSyncManager() *SyncManager {
	sm := &SyncManager{
		gitService: NewService(),
		queue:      make(chan string, 100),
		reasons:    make([]string, 0),
		debounce:   2 * time.Second,
	}

	go sm.processQueue()

	return sm
}

func (sm *SyncManager) NotifyChange(reason string) {
	if sm.closed.Load() {
		return
	}

	gitCfg := config.GetGitSyncConfig()
	if !gitCfg.Enabled || !gitCfg.AutoCommit {
		return
	}

	select {
	case sm.queue <- reason:
	default:
		logger.Debug("sync queue full, dropping notification")
	}
}

func (sm *SyncManager) processQueue() {
	for reason := range sm.queue {
		sm.mu.Lock()
		sm.reasons = append(sm.reasons, reason)

		if sm.timer != nil {
			sm.timer.Stop()
		}

		sm.timer = time.AfterFunc(sm.debounce, func() {
			sm.mu.Lock()
			reasons := sm.reasons
			sm.reasons = make([]string, 0)
			sm.mu.Unlock()

			sm.performSync(reasons)
		})

		sm.mu.Unlock()
	}
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

	if err := sm.gitService.AddAll(dataDir); err != nil {
		logger.WithField("error", err).Warn("auto-sync: git add failed")
		return
	}

	commitMsg := sm.buildCommitMessage(reasons)
	if err := sm.gitService.Commit(dataDir, commitMsg); err != nil {
		if err.Error() == "nothing to commit" {
			logger.Debug("auto-sync: nothing to commit")
			return
		}
		logger.WithField("error", err).Warn("auto-sync: git commit failed")
		return
	}

	logger.WithFields(map[string]any{
		"operations": len(reasons),
		"message":    commitMsg,
	}).Info("auto-sync: committed successfully")

	gitCfg := config.GetGitSyncConfig()
	if gitCfg.AutoPush {
		logger.Debug("auto-sync: pushing to remote")
		if err := sm.gitService.Push(dataDir, "origin", "master"); err != nil {
			logger.WithField("error", err).Warn("auto-sync: push failed (commit was successful locally)")
		} else {
			logger.WithField("time", time.Now().Format("15:04:05")).Info("auto-sync: pushed to remote successfully")
		}
	}
}

func (sm *SyncManager) buildCommitMessage(reasons []string) string {
	if len(reasons) == 1 {
		return fmt.Sprintf("auto: %s", reasons[0])
	}

	return fmt.Sprintf("auto: %d changes", len(reasons))
}

func (sm *SyncManager) Shutdown() {
	if !sm.closed.CompareAndSwap(false, true) {
		return
	}

	sm.mu.Lock()
	if sm.timer != nil {
		sm.timer.Stop()
	}
	sm.mu.Unlock()

	close(sm.queue)
}
