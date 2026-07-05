package git

import (
	"sync"
	"testing"
)

func TestOperationLock_MutualExclusion(t *testing.T) {
	l := NewOperationLock()

	rel, _, ok := l.TryAcquire("auto")
	if !ok {
		t.Fatal("first acquire should succeed")
	}

	if _, holder, ok := l.TryAcquire("manual"); ok || holder != "auto" {
		t.Fatalf("second acquire should fail with holder=auto; got ok=%v holder=%q", ok, holder)
	}

	rel()

	if _, _, ok := l.TryAcquire("manual"); !ok {
		t.Fatal("acquire after release should succeed")
	}
}

func TestOperationLock_ReleaseIdempotent(t *testing.T) {
	l := NewOperationLock()
	rel, _, _ := l.TryAcquire("x")
	rel()
	rel() // must not panic or corrupt state
	if _, _, ok := l.TryAcquire("y"); !ok {
		t.Fatal("lock should be free after idempotent release")
	}
}

// Under concurrency at most one holder may be active at any instant.
func TestOperationLock_NoOverlap(t *testing.T) {
	l := NewOperationLock()
	var mu sync.Mutex
	active, maxActive := 0, 0
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rel, _, ok := l.TryAcquire("w")
			if !ok {
				return
			}
			mu.Lock()
			active++
			if active > maxActive {
				maxActive = active
			}
			mu.Unlock()
			mu.Lock()
			active--
			mu.Unlock()
			rel()
		}()
	}
	wg.Wait()
	if maxActive > 1 {
		t.Fatalf("more than one holder observed: %d", maxActive)
	}
}
