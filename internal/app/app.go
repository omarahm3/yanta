package app

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.design/x/hotkey"
	"golang.design/x/hotkey/mainthread"

	"yanta/internal/asset"
	"yanta/internal/commandline"
	"yanta/internal/db"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/indexer"
	"yanta/internal/link"
	"yanta/internal/logger"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/seed"
	"yanta/internal/system"
	"yanta/internal/tag"
	"yanta/internal/vault"
)

type App struct {
	ctx context.Context

	DB *sql.DB

	Bindings *Bindings

	DBPath string

	restoreHotkey *hotkey.Hotkey
	syncManager   *git.SyncManager
	eventBus      *events.EventBus

	wailsApp   *application.App
	mainWindow *application.WebviewWindow
}

type Config struct {
	DBPath string
}

func New(cfg Config) (*App, error) {
	a := &App{
		DBPath: cfg.DBPath,
	}

	var err error
	a.DB, err = db.OpenDB(a.DBPath)
	if err != nil {
		return nil, err
	}
	logger.Debugf("database opened: %s", a.DBPath)

	if err := db.RunMigrations(a.DB); err != nil {
		return nil, err
	}

	logger.Debugf("migrations completed")

	if err := db.IntegrityCheck(a.DB); err != nil {
		logger.Errorf("database integrity check failed: %v", err)
		return nil, err
	}

	if err := db.SeedProjects(a.DB); err != nil {
		logger.Errorf("failed to seed demo projects: %v", err)
		return nil, err
	}

	v, err := vault.New(vault.Config{})
	if err != nil {
		return nil, err
	}

	eventBus := events.NewEventBus()
	a.eventBus = eventBus

	syncManager := git.NewSyncManager()
	a.syncManager = syncManager

	projectStore := project.NewStore(a.DB)
	documentStore := document.NewStore(a.DB)
	tagStore := tag.NewStore(a.DB)
	linkStore := link.NewStore(a.DB)
	assetStore := asset.NewStore(a.DB)
	ftsStore := search.NewStore(a.DB)

	idx := indexer.New(
		a.DB,
		v,
		documentStore,
		projectStore,
		ftsStore,
		tagStore,
		linkStore,
		assetStore,
		syncManager,
	)

	projectCache := project.NewCache(projectStore)
	projectService := project.NewService(a.DB, projectStore, projectCache, v, eventBus)
	documentService := document.NewService(a.DB, documentStore, v, idx, projectCache, eventBus)
	documentFileManager := document.NewFileManager(v)
	tagService := tag.NewService(a.DB, tagStore, documentFileManager, eventBus)
	searchService := search.NewService(a.DB, eventBus)
	systemService := system.NewService(a.DB, eventBus)
	systemService.SetDBPath(a.DBPath)

	assetService := asset.NewService(asset.ServiceConfig{
		DB:          a.DB,
		Store:       assetStore,
		Vault:       v,
		SyncManager: syncManager,
	})

	logger.Debugf("services created")

	if err := seedDemoDocuments(v, documentStore, idx); err != nil {
		logger.Warnf("failed to seed demo documents: %v", err)
	}

	logger.Info("scanning vault for existing documents...")
	if err := idx.ScanAndIndexVault(context.Background()); err != nil {
		logger.Errorf("failed to scan and index vault: %v", err)
	}

	projectCommands := commandline.NewProjectCommands(
		projectService,
		documentService,
		v,
		syncManager,
		eventBus,
	)
	globalCommands := commandline.NewGlobalCommands(projectService, systemService)
	documentCommands := commandline.NewDocumentCommands(documentService, tagService)

	logger.Debugf("command handlers created")

	a.Bindings = &Bindings{
		Projects:         projectService,
		Documents:        documentService,
		Tags:             tagService,
		Search:           searchService,
		System:           systemService,
		Assets:           assetService,
		ProjectCommands:  projectCommands,
		GlobalCommands:   globalCommands,
		DocumentCommands: documentCommands,
		EventBus:         eventBus,
		shutdownHandler:  a.OnShutdown,
	}

	logger.Debugf("bindings created")

	return a, nil
}

func (a *App) SetWailsApp(app *application.App) {
	a.wailsApp = app

	if a.eventBus != nil && a.mainWindow != nil {
		a.eventBus.Connect(app, a.mainWindow)
	}
}

func (a *App) SetMainWindow(window *application.WebviewWindow) {
	a.mainWindow = window

	if a.eventBus != nil && a.wailsApp != nil {
		a.eventBus.Connect(a.wailsApp, window)
	}
}

func (a *App) Startup(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			logger.Errorf("PANIC during Startup: %v", r)
			a.writeCrashReport("Startup", r)
		}
	}()

	a.ctx = ctx
	logger.Info("application started and ready")

	if a.wailsApp != nil {
		a.wailsApp.Event.Emit(events.AppReady, map[string]any{
			"dbPath":  a.DBPath,
			"version": BuildVersion,
		})
	}

	if a.Bindings != nil {
		a.Bindings.OnStartup()
	}

	if a.wailsApp != nil {
		a.wailsApp.Event.On("app:quit", func(event *application.CustomEvent) {
			logger.Info("Received app:quit event")
			a.wailsApp.Quit()
		})

		a.wailsApp.Event.On("app:force-quit", func(event *application.CustomEvent) {
			logger.Info("Received app:force-quit event")
			a.wailsApp.Quit()
		})
	}

	sessionType := os.Getenv("XDG_SESSION_TYPE")
	logger.Debugf("XDG_SESSION_TYPE: %s", sessionType)

	switch runtime.GOOS {
	case "darwin":
		logger.Info("skipping global hotkey registration on macOS (disabled)")
	case "linux":
		logger.Info("skipping global hotkey registration on Linux (disabled)")
	default:
		a.registerRestoreHotkey()
	}
}

func (a *App) BeforeClose() bool {
	logger.Debug("BeforeClose called")

	if a.Bindings == nil || a.Bindings.System == nil {
		logger.Debug("app not fully initialized, allowing close")
		return false
	}

	keepInBackground := a.Bindings.System.GetKeepInBackground(context.Background())
	logger.Debugf("keepInBackground setting: %v", keepInBackground)

	if keepInBackground {
		logger.Debug("hiding window to background")
		if a.mainWindow != nil {
			a.mainWindow.Hide()
		}
		if a.wailsApp != nil {
			a.wailsApp.Event.Emit(events.WindowHidden, map[string]any{
				"reason": "keep_in_background",
			})
		}
		return true
	}

	logger.Debug("allowing window close")
	return false
}

func (a *App) OnShutdown() {
	a.Shutdown()
}

func (a *App) Shutdown() {
	defer func() {
		if r := recover(); r != nil {
			logger.Errorf("PANIC during Shutdown: %v", r)
			a.writeCrashReport("Shutdown", r)
		}
	}()

	logger.Info("application shutdown initiated")

	done := make(chan struct{})
	go func() {
		defer close(done)

		if a.syncManager != nil {
			logger.Debug("shutting down sync manager...")
			a.syncManager.Shutdown()
			logger.Debug("sync manager shut down")
		}

		if a.DB != nil {
			logger.Debug("closing database connection...")
			if err := db.CloseDB(a.DB); err != nil {
				logger.Errorf("failed to close database: %v", err)
			} else {
				logger.Debug("database closed successfully")
			}
			a.DB = nil
		}

		if a.restoreHotkey != nil {
			logger.Debug("unregistering global hotkey...")
			hotkeyDone := make(chan struct{})
			go func() {
				defer func() {
					if r := recover(); r != nil {
						logger.Errorf("panic during hotkey unregister: %v", r)
					}
					close(hotkeyDone)
				}()
				if err := a.restoreHotkey.Unregister(); err != nil {
					logger.Errorf("failed to unregister hotkey: %v", err)
				}
			}()

			select {
			case <-hotkeyDone:
				logger.Debug("hotkey unregistered successfully")
			case <-time.After(500 * time.Millisecond):
				logger.Warn("hotkey unregister timeout, continuing shutdown anyway")
			}
		}
	}()

	select {
	case <-done:
		logger.Info("application shutdown completed successfully")
	case <-time.After(2 * time.Second):
		logger.Warn("shutdown timeout reached (2s), forcing cleanup completion")
	}

	logger.Debug("calling os.Exit(0) to ensure clean termination")
	os.Exit(0)
}

func (a *App) registerRestoreHotkey() {
	go func() {
		// Required for Windows hotkey registration
		var hk *hotkey.Hotkey
		var err error

		mainthread.Call(func() {
			hk = hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.KeyY)
			err = hk.Register()
		})

		if err != nil {
			logger.Errorf("failed to register global hotkey Ctrl+Shift+Y: %v", err)
			return
		}

		a.restoreHotkey = hk
		logger.Info("registered global hotkey Ctrl+Shift+Y to restore window")

		for range hk.Keydown() {
			logger.Debug("Ctrl+Shift+Y pressed, restoring window...")
			if a.mainWindow != nil {
				a.mainWindow.Show()
				a.mainWindow.Restore()
				logger.Debug("window restored")
			}
		}
	}()
}

func (a *App) writeCrashReport(location string, panicValue any) {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	crashFile := fmt.Sprintf("crash-%s-%s.log", location, timestamp)

	var crashPath string
	if home, err := os.UserHomeDir(); err == nil {
		crashDir := filepath.Join(home, ".yanta", "crashes")
		os.MkdirAll(crashDir, 0o755)
		crashPath = filepath.Join(crashDir, crashFile)
	} else {
		crashPath = crashFile
	}

	f, err := os.OpenFile(crashPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		logger.Errorf("failed to create crash report: %v", err)
		return
	}
	defer f.Close()

	fmt.Fprintf(f, "=== YANTA CRASH REPORT ===\n")
	fmt.Fprintf(f, "Time: %s\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "Location: %s\n", location)
	fmt.Fprintf(f, "Version: %s\n", BuildVersion)
	fmt.Fprintf(f, "Database: %s\n\n", a.DBPath)
	fmt.Fprintf(f, "Panic Value:\n%v\n\n", panicValue)
	fmt.Fprintf(f, "Stack Trace:\n")

	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	fmt.Fprintf(f, "%s\n", buf[:n])

	logger.Infof("crash report written to: %s", crashPath)
}

func seedDemoDocuments(v *vault.Vault, docStore *document.Store, idx *indexer.Indexer) error {
	ctx := context.Background()

	docs, err := docStore.Get(ctx, &document.GetFilters{})
	if err != nil {
		return err
	}

	if len(docs) > 0 {
		logger.Debug("documents already exist, skipping seed")
		return nil
	}

	logger.Info("seeding demo documents...")

	demoDocuments := seed.GetDemoDocuments()
	fileWriter := document.NewFileWriter(v)

	for _, seedDoc := range demoDocuments {
		if err := document.ValidateBlockNoteStructure(seedDoc.Blocks); err != nil {
			return fmt.Errorf(
				"seed document '%s' has invalid BlockNote structure: %w",
				seedDoc.Title,
				err,
			)
		}

		now := time.Now()
		docFile := &document.DocumentFile{
			Meta: document.DocumentMeta{
				Project: seedDoc.ProjectAlias,
				Title:   seedDoc.Title,
				Tags:    seedDoc.Tags,
				Aliases: []string{},
				Created: now,
				Updated: now,
			},
			Blocks: seedDoc.Blocks,
		}

		timestamp := now.UnixMicro()
		aliasSlug := strings.TrimPrefix(seedDoc.ProjectAlias, "@")
		filename := fmt.Sprintf("doc-%s-%d.json", aliasSlug, timestamp)
		relativePath := fmt.Sprintf("projects/%s/%s", seedDoc.ProjectAlias, filename)

		if err := fileWriter.WriteFile(relativePath, docFile); err != nil {
			logger.Errorf("failed to write seed document: %v", err)
			continue
		}

		if err := idx.IndexDocument(ctx, relativePath); err != nil {
			logger.Errorf("failed to index seed document: %v", err)
			continue
		}

		logger.Debugf("seeded document: %s (%s)", seedDoc.Title, relativePath)
	}

	logger.Info("demo documents seeded successfully")
	return nil
}
