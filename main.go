package main

import (
	"context"
	"crypto/sha1"
	"embed"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	runtimePkg "runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"yanta/internal/app"
	"yanta/internal/asset"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/logger"
	"yanta/internal/mcpbridge"
	"yanta/internal/quickcapture"
	"yanta/internal/vault"
	windowcfg "yanta/internal/window"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	// `yanta mcp` runs the stdio<->HTTP bridge for external AI agents and exits.
	// Dispatch before any GUI/Wails init so it stays headless and never trips the
	// single-instance guard or spawns a window.
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		if err := mcpbridge.Run(context.Background()); err != nil {
			fmt.Fprintln(os.Stderr, "yanta mcp: "+err.Error())
			os.Exit(1)
		}
		return
	}
	run()
}

func run() {
	if err := config.Init(); err != nil {
		writeStartupError(fmt.Sprintf("Failed to initialize config: %v", err))
		log.Fatalf("failed to initialize config: %v", err)
	}

	if err := logger.InitFromEnv(); err != nil {
		writeStartupError(fmt.Sprintf("Failed to initialize logger: %v", err))
		log.Fatalf("failed to initialize logger: %v", err)
	}

	graphicsState := app.ConfigureGraphicsEnvironment()

	logger.Info("starting YANTA...")

	a, err := app.New(app.Config{DBPath: db.DefaultPath()})
	if err != nil {
		writeStartupError(fmt.Sprintf("Failed to create app: %v", err))
		logger.Fatalf("failed to create app: %v", err)
	}

	logger.Debug("application container created")

	if err := a.StartMCPIfEnabled(); err != nil {
		logger.Errorf("failed to start MCP server: %v", err)
	}

	startHidden := config.GetStartHidden()
	logger.Infof("start_hidden config: %v", startHidden)

	frameless := config.IsLinuxFrameless()
	logger.Infof(
		"platform: %s, frameless: %v, linux_window_mode: %s",
		runtimePkg.GOOS,
		frameless,
		config.GetLinuxWindowMode(),
	)

	customAssetHandler := createCustomAssetHandler(a.Bindings.Assets)

	// Check if this is a quick capture launch
	isQuickLaunch := hasQuickFlag(os.Args)
	logger.Infof("quick launch mode: %v", isQuickLaunch)
	singleInstanceID := buildSingleInstanceID()
	logger.Infof("single instance id: %s", singleInstanceID)

	wailsApp := application.New(application.Options{
		Name:        "YANTA",
		Description: "Your Advanced Note Taking Application",
		Icon:        appIcon,
		// SingleInstance ensures only one Yanta instance runs.
		// Second instance launches trigger OnSecondInstanceLaunch.
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: singleInstanceID,
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				logger.Infof("second instance launched with args: %v", data.Args)

				// Check for --quick or -q flag
				for _, arg := range data.Args {
					if arg == "--quick" || arg == "-q" {
						logger.Info("opening Quick Capture window from second instance")
						quickcapture.ShowWindow()
						return
					}
				}

				// No quick flag - focus main window
				logger.Info("focusing main window from second instance")
				if mainWindow := a.GetMainWindow(); mainWindow != nil {
					mainWindow.Show()
					mainWindow.Focus()
				}
			},
		},

		Services: []application.Service{
			application.NewService(a.Bindings.Projects),
			application.NewService(a.Bindings.Documents),
			application.NewService(a.Bindings.Tags),
			application.NewService(a.Bindings.Search),
			application.NewService(a.Bindings.Plugins),
			application.NewService(a.Bindings.System),
			application.NewService(a.Bindings.Assets),
			application.NewService(a.Bindings.Journal),
			application.NewService(a.Bindings.Config),
			application.NewService(a.Bindings.Backup),
			application.NewService(a.Bindings.Export),
			application.NewService(a.Bindings.ProjectCommands),
			application.NewService(a.Bindings.GlobalCommands),
			application.NewService(a.Bindings.DocumentCommands),
			application.NewService(a.Bindings.MCP),
			application.NewService(windowcfg.NewService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
			Middleware: application.ChainMiddleware(
				customAssetHandler,
			),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	a.SetWailsApp(wailsApp)

	// Set app reference for Quick Capture window creation
	quickcapture.SetApp(wailsApp)

	initTheme := config.GetTheme()
	bgColour := application.NewRGBA(35, 38, 41, 255)
	macAppearance := application.NSAppearanceNameDarkAqua
	customTheme := getWindowsCustomTheme()
	winTheme := application.Dark

	if initTheme == config.ThemeLight {
		bgColour = application.NewRGBA(244, 246, 248, 255)
		macAppearance = application.NSAppearanceNameAqua
		customTheme = getLightWindowsTheme()
		winTheme = application.Light
	} else if initTheme == config.ThemeSystem {
		macAppearance = ""
		winTheme = application.SystemDefault
	}

	mainWindow := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "YANTA",
		Width:            windowcfg.DefaultWidth,
		Height:           windowcfg.DefaultHeight,
		MinWidth:         windowcfg.MinWidth,
		MinHeight:        windowcfg.MinHeight,
		Hidden:           startHidden,
		Frameless:        frameless,
		URL:              "/",
		BackgroundColour: bgColour,
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			Appearance:              macAppearance,
			InvisibleTitleBarHeight: 50,
		},
		Windows: application.WindowsWindow{
			Theme:        winTheme,
			CustomTheme:  customTheme,
			BackdropType: application.Mica,
		},
		Linux: application.LinuxWindow{
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    graphicsState.GpuPolicy,
		},
	})

	a.SetMainWindow(mainWindow)
	config.InitWailsService(a.Bindings.Config, a.Bindings.EventBus, mainWindow)

	wailsApp.Event.OnApplicationEvent(
		events.Common.ApplicationStarted,
		func(event *application.ApplicationEvent) {
			logger.Debug("ApplicationStarted event fired, calling app.Startup()")
			a.Startup(context.Background())
			app.MarkGraphicsStartupSuccessful()

			// If this is a quick launch, open Quick Capture window
			if isQuickLaunch {
				logger.Info("opening Quick Capture window on startup")
				quickcapture.CreateWindow(wailsApp)
			}
		},
	)

	wailsApp.OnShutdown(func() {
		logger.Debug("OnShutdown called")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := a.StopMCP(shutdownCtx); err != nil {
			logger.Warnf("MCP server shutdown: %v", err)
		}
		cancel()
		a.Shutdown()
	})

	isQuitting := false
	mainWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		logger.Debug("WindowClosing event fired")
		if isQuitting {
			logger.Debug("quit already in progress, allowing close")
			return
		}

		if a.BeforeClose() {
			logger.Debug("Window close prevented, hiding to background")
			e.Cancel()
		} else {
			logger.Debug("Window close allowed, flushing dirty editors before quit")
			e.Cancel()
			isQuitting = true

			flushDone := make(chan struct{})
			var flushOnce sync.Once
			wailsApp.Event.On("yanta/app/flush-dirty:ack", func(event *application.CustomEvent) {
				logger.Debug("Received flush-dirty ack from frontend")
				// Guard the close: the frontend may ack more than once, and
				// closing an already-closed channel panics.
				flushOnce.Do(func() { close(flushDone) })
			})

			wailsApp.Event.Emit("yanta/app/flush-dirty", nil)

			go func() {
				select {
				case <-flushDone:
					logger.Debug("Frontend flush completed, quitting")
				case <-time.After(3 * time.Second):
					logger.Warn("Frontend flush timed out (3s), quitting anyway")
				}
				wailsApp.Quit()
			}()
		}
	})

	err = wailsApp.Run()
	if err != nil {
		writeStartupError(fmt.Sprintf("Failed to run Wails application: %v", err))
		logger.Errorf("failed to run Wails application: %v", err)
	}

	logger.Debug("Wails application exited")
}

func writeStartupError(message string) {
	root := config.GetAppRootDirectory()
	if root == "" {
		root = config.GetDataDirectory()
	}
	errorFile := filepath.Join(root, "startup-error.log")
	if err := os.MkdirAll(filepath.Dir(errorFile), 0o755); err != nil {
		return
	}
	f, err := os.OpenFile(errorFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o666)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), message)
}

func getWindowsCustomTheme() application.ThemeSettings {
	return application.ThemeSettings{
		// Paper & Ink — dark companion: graphite surface #232629, ink #E6E8EB.
		DarkModeActive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(35, 38, 41),
			TitleTextColour: application.NewRGBPtr(230, 232, 235),
			BorderColour:    application.NewRGBPtr(51, 55, 60),
		},
		DarkModeInactive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(31, 34, 37),
			TitleTextColour: application.NewRGBPtr(156, 163, 173),
			BorderColour:    application.NewRGBPtr(42, 46, 50),
		},
		// Paper & Ink — light lead: chrome #F4F6F8, ink #1A1C1F, hairline #E2E5EA.
		LightModeActive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(244, 246, 248),
			TitleTextColour: application.NewRGBPtr(26, 28, 31),
			BorderColour:    application.NewRGBPtr(226, 229, 234),
		},
		LightModeInactive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(238, 240, 243),
			TitleTextColour: application.NewRGBPtr(122, 128, 138),
			BorderColour:    application.NewRGBPtr(226, 229, 234),
		},
	}
}

func getLightWindowsTheme() application.ThemeSettings {
	return application.ThemeSettings{
		LightModeActive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(244, 246, 248),
			TitleTextColour: application.NewRGBPtr(26, 28, 31),
			BorderColour:    application.NewRGBPtr(226, 229, 234),
		},
		LightModeInactive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(238, 240, 243),
			TitleTextColour: application.NewRGBPtr(122, 128, 138),
			BorderColour:    application.NewRGBPtr(226, 229, 234),
		},
	}
}

func buildSingleInstanceID() string {
	root := config.GetAppRootDirectory()
	if root == "" {
		return "com.yanta.app"
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		absRoot = root
	}
	normalized := strings.ToLower(filepath.Clean(absRoot))
	hash := sha1.Sum([]byte(normalized))
	suffix := hex.EncodeToString(hash[:8])
	return "com.yanta.app." + suffix
}

// hasQuickFlag checks if --quick or -q flag is present in args
func hasQuickFlag(args []string) bool {
	for _, arg := range args {
		if arg == "--quick" || arg == "-q" {
			return true
		}
	}
	return false
}

func createCustomAssetHandler(assetService *asset.Service) application.Middleware {
	uploadHandler := asset.NewUploadHandler(assetService)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Handle asset uploads via HTTP POST (bypasses Wails RPC URL length limits)
			if strings.HasPrefix(r.URL.Path, "/api/upload") {
				uploadHandler.ServeHTTP(w, r)
				return
			}

			if !strings.HasPrefix(r.URL.Path, "/assets/") {
				next.ServeHTTP(w, r)
				return
			}

			if r.Method != http.MethodGet {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}

			trimmed := strings.TrimPrefix(r.URL.Path, "/assets/")
			parts := strings.SplitN(trimmed, "/", 2)
			if len(parts) != 2 {
				// Let the default asset server handle frontend bundles like /assets/index-*.js
				next.ServeHTTP(w, r)
				return
			}

			projectAlias := parts[0]
			if projectAlias == "" || !strings.HasPrefix(projectAlias, "@") {
				next.ServeHTTP(w, r)
				return
			}

			file := parts[1]
			dot := strings.LastIndex(file, ".")
			if dot <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			hash := file[:dot]
			ext := file[dot:]

			if err := asset.ValidateHash(hash); err != nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			if err := asset.ValidateExtension(ext); err != nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			v, verr := vault.New(vault.Config{})
			if verr != nil {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			data, rerr := asset.ReadAsset(v, projectAlias, hash, ext)
			if rerr != nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			w.Header().Set("Content-Type", asset.DetectMIME(ext))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
		})
	}
}
