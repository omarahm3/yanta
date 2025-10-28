package git

func NewMockSyncManager() *SyncManager {
	sm := &SyncManager{
		gitService: nil,
		queue:      make(chan string, 100),
		reasons:    make([]string, 0),
		debounce:   0,
	}
	sm.closed.Store(true)
	return sm
}
