package git

// NewMockSyncManager creates a SyncManager for testing that doesn't perform actual syncs.
// It's already in a closed state so NotifyChange calls are ignored.
func NewMockSyncManager() *SyncManager {
	sm := &SyncManager{
		gitService: nil,
		db:         nil,
		reasons:    make([]string, 0),
		done:       make(chan struct{}),
	}
	sm.closed.Store(true)
	return sm
}
