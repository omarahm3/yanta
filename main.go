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
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"yanta/internal/app"
	"yanta/internal/asset"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/logger"
	"yanta/internal/quickcapture"
	"yanta/internal/vault"
	windowcfg "yanta/internal/window"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
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

	mainWindow := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "YANTA",
		Width:            windowcfg.DefaultWidth,
		Height:           windowcfg.DefaultHeight,
		MinWidth:         windowcfg.MinWidth,
		MinHeight:        windowcfg.MinHeight,
		Hidden:           startHidden,
		Frameless:        frameless,
		URL:              "/",
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			Appearance:              application.NSAppearanceNameDarkAqua,
			InvisibleTitleBarHeight: 50,
		},
		Windows: application.WindowsWindow{
			Theme:        application.SystemDefault,
			CustomTheme:  getWindowsCustomTheme(),
			BackdropType: application.Mica,
		},
		Linux: application.LinuxWindow{
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    graphicsState.GpuPolicy,
		},
	})

	a.SetMainWindow(mainWindow)

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
			logger.Debug("Window close allowed, requesting application quit")
			e.Cancel()
			isQuitting = true
			wailsApp.Quit()
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
		DarkModeActive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(27, 38, 54),
			TitleTextColour: application.NewRGBPtr(220, 220, 220),
			BorderColour:    application.NewRGBPtr(40, 50, 65),
		},
		DarkModeInactive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(20, 29, 42),
			TitleTextColour: application.NewRGBPtr(140, 140, 140),
			BorderColour:    application.NewRGBPtr(30, 40, 50),
		},
		LightModeActive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(245, 245, 245),
			TitleTextColour: application.NewRGBPtr(30, 30, 30),
			BorderColour:    application.NewRGBPtr(210, 210, 210),
		},
		LightModeInactive: &application.WindowTheme{
			TitleBarColour:  application.NewRGBPtr(235, 235, 235),
			TitleTextColour: application.NewRGBPtr(120, 120, 120),
			BorderColour:    application.NewRGBPtr(230, 230, 230),
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
