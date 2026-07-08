package indexer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/vault"

	"github.com/fsnotify/fsnotify"
)

type DocumentIndexer interface {
	IndexDocument(ctx context.Context, path string) error
	RemoveDocument(ctx context.Context, path string) error
	RemoveDocumentCompletely(ctx context.Context, path string) error
	ClearIndex(ctx context.Context) error
}

type Watcher struct {
	vault   *vault.Vault
	indexer DocumentIndexer
	watcher *fsnotify.Watcher

	debounce       map[string]*time.Timer
	debounceMu     sync.Mutex
	debounceWindow time.Duration

	eventBus *events.EventBus

	fileReader *document.FileReader

	// hashMu protects reconciledHashes. reconciledHashes[relPath] holds the
	// content hash of the last version the app has already reconciled (written
	// or indexed) for that path. A disk change whose hash matches is a self-write
	// and is ignored; anything else is a genuine external change.
	hashMu           sync.Mutex
	reconciledHashes map[string]string

	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}

	errors chan error
}

type WatcherOption func(*Watcher)

func WithDebounceWindow(d time.Duration) WatcherOption {
	return func(w *Watcher) {
		w.debounceWindow = d
	}
}

func WithEventBus(bus *events.EventBus) WatcherOption {
	return func(w *Watcher) {
		w.eventBus = bus
	}
}

func NewWatcher(
	vault *vault.Vault,
	indexer DocumentIndexer,
	opts ...WatcherOption,
) (*Watcher, error) {
	fsWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("creating fsnotify watcher: %w", err)
	}

	w := &Watcher{
		vault:            vault,
		indexer:          indexer,
		watcher:          fsWatcher,
		fileReader:       document.NewFileReader(vault),
		debounce:         make(map[string]*time.Timer),
		debounceWindow:   500 * time.Millisecond,
		reconciledHashes: make(map[string]string),
		errors:           make(chan error, 10),
		done:             make(chan struct{}),
	}

	for _, opt := range opts {
		opt(w)
	}

	return w, nil
}

func (w *Watcher) Start(ctx context.Context) error {
	w.ctx, w.cancel = context.WithCancel(ctx)

	projectsPath := filepath.Join(w.vault.RootPath(), "projects")
	if err := w.addRecursive(projectsPath); err != nil {
		return fmt.Errorf("watching projects directory: %w", err)
	}

	go w.eventLoop()

	return nil
}

func (w *Watcher) addRecursive(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			if err := w.watcher.Add(path); err != nil {
				return fmt.Errorf("adding directory %s: %w", path, err)
			}
		}

		return nil
	})
}

func (w *Watcher) eventLoop() {
	defer close(w.done)

	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.handleEvent(event)

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			w.handleError(err)

		case <-w.ctx.Done():
			return
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	if event.Op&fsnotify.Create == fsnotify.Create {
		info, err := os.Stat(event.Name)
		if err == nil && info.IsDir() {
			_ = w.watcher.Add(event.Name)
		}
	}

	if !isDocumentFile(event.Name) {
		return
	}

	relPath, err := w.vault.RelativePath(event.Name)
	if err != nil {
		w.errors <- fmt.Errorf("converting to relative path: %w", err)
		return
	}

	w.scheduleIndexing(relPath, event.Op)
}

func isDocumentFile(path string) bool {
	slashPath := filepath.ToSlash(path)
	return filepath.Ext(path) == ".json" &&
		strings.Contains(slashPath, "projects/") &&
		!strings.Contains(slashPath, "/assets/")
}

func (w *Watcher) scheduleIndexing(relPath string, op fsnotify.Op) {
	w.debounceMu.Lock()
	defer w.debounceMu.Unlock()

	if timer, exists := w.debounce[relPath]; exists {
		timer.Stop()
	}

	w.debounce[relPath] = time.AfterFunc(w.debounceWindow, func() {
		w.executeIndexing(relPath, op)

		w.debounceMu.Lock()
		delete(w.debounce, relPath)
		w.debounceMu.Unlock()
	})
}

func (w *Watcher) executeIndexing(relPath string, op fsnotify.Op) {
	ctx := context.Background()

	switch {
	case op&fsnotify.Create == fsnotify.Create,
		op&fsnotify.Write == fsnotify.Write:
		// Compare the on-disk content against the last version the app reconciled.
		// If they match, this write was made by the app itself (Save already indexed
		// it), so skip re-indexing and don't report a phantom external change. This
		// is timing-independent: it reads the actual file state rather than relying
		// on a suppression flag that may have expired by the time this runs.
		diskHash, ok := w.diskContentHash(relPath)
		if ok && w.isReconciled(relPath, diskHash) {
			return
		}

		if err := w.indexer.IndexDocument(ctx, relPath); err != nil {
			w.errors <- fmt.Errorf("indexing %s: %w", relPath, err)
		}
		// Record what we just reconciled so a duplicate event for the same content
		// (or a later app write) is recognized and not reported again.
		if ok {
			w.setReconciled(relPath, diskHash)
		}
		if w.eventBus != nil {
			w.eventBus.Emit(events.EntryExternalChange, events.EntryExternalChangeData{
				Path: relPath,
			})
		}

	case op&fsnotify.Remove == fsnotify.Remove:
		w.forgetReconciled(relPath)
		if err := w.indexer.RemoveDocumentCompletely(ctx, relPath); err != nil {
			if !strings.Contains(err.Error(), "not found") {
				w.errors <- fmt.Errorf("removing %s: %w", relPath, err)
			}
		}

	case op&fsnotify.Rename == fsnotify.Rename:
		w.forgetReconciled(relPath)
		if err := w.indexer.RemoveDocumentCompletely(ctx, relPath); err != nil {
			if !strings.Contains(err.Error(), "not found") {
				w.errors <- fmt.Errorf("removing renamed %s: %w", relPath, err)
			}
		}
	}
}

func (w *Watcher) Stop() error {
	if w.cancel != nil {
		w.cancel()
	}

	<-w.done

	w.debounceMu.Lock()
	for _, timer := range w.debounce {
		timer.Stop()
	}
	w.debounce = make(map[string]*time.Timer)
	w.debounceMu.Unlock()

	if err := w.watcher.Close(); err != nil {
		return fmt.Errorf("closing watcher: %w", err)
	}

	return nil
}

func (w *Watcher) Errors() <-chan error {
	return w.errors
}

func (w *Watcher) handleError(err error) {
	select {
	case w.errors <- err:
	default:
	}
}

// NoteAppWrite records the content hash the app has just written for relPath.
// The next filesystem event whose on-disk content hashes to the same value is
// recognized as the app's own write and ignored, so the app never sees a
// phantom external-change for its own saves. contentHash must be computed the
// same way the watcher computes it (ComputeFileHash of the parsed document).
func (w *Watcher) NoteAppWrite(relPath, contentHash string) {
	if contentHash == "" {
		return
	}
	w.setReconciled(relPath, contentHash)
}

// setReconciled records contentHash as the latest version the watcher has
// reconciled for relPath.
func (w *Watcher) setReconciled(relPath, contentHash string) {
	w.hashMu.Lock()
	defer w.hashMu.Unlock()
	w.reconciledHashes[relPath] = contentHash
}

// forgetReconciled drops any reconciled hash for relPath, e.g. after the file
// is removed or renamed away.
func (w *Watcher) forgetReconciled(relPath string) {
	w.hashMu.Lock()
	defer w.hashMu.Unlock()
	delete(w.reconciledHashes, relPath)
}

// isReconciled reports whether diskHash matches the last version the app has
// already reconciled for relPath.
func (w *Watcher) isReconciled(relPath, diskHash string) bool {
	w.hashMu.Lock()
	defer w.hashMu.Unlock()
	return w.reconciledHashes[relPath] == diskHash
}

// diskContentHash reads the document at relPath and returns its content hash.
// The second return is false if the file could not be read or parsed, in which
// case the caller treats the change as external (the safe direction).
func (w *Watcher) diskContentHash(relPath string) (string, bool) {
	df, err := w.fileReader.ReadFile(relPath)
	if err != nil {
		return "", false
	}
	return document.ComputeFileHash(df), true
}
