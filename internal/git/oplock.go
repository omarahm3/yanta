package git

import "sync"

// OperationLock serializes git operations on a repository across the whole app.
// The automatic sync manager and the manual sync/push/pull paths share ONE
// instance so their git subprocesses can never run concurrently on the same
// working tree — which would race on .git/index.lock and could leave a
// half-updated index or interleaved commits.
//
// Acquisition is non-blocking (TryAcquire): a caller that can't get the lock
// backs off rather than queueing, matching how both paths already behaved
// (auto-sync skips the tick; a manual op reports "already running").
type OperationLock struct {
	mu       sync.Mutex
	inFlight bool
	holder   string
}

// NewOperationLock returns a ready-to-use lock.
func NewOperationLock() *OperationLock {
	return &OperationLock{}
}

// TryAcquire takes the lock without blocking. On success it returns an
// idempotent release func and ok=true. If another operation holds it, it
// returns that operation's label as holder and ok=false.
func (l *OperationLock) TryAcquire(label string) (release func(), holder string, ok bool) {
	l.mu.Lock()
	if l.inFlight {
		h := l.holder
		l.mu.Unlock()
		return nil, h, false
	}
	l.inFlight = true
	l.holder = label
	l.mu.Unlock()

	var once sync.Once
	return func() {
		once.Do(func() {
			l.mu.Lock()
			l.inFlight = false
			l.holder = ""
			l.mu.Unlock()
		})
	}, "", true
}
