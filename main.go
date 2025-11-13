package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"yanta/internal/app"
	"yanta/internal/asset"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/logger"
	"yanta/internal/vault"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if err := config.Init(); err != nil {
		writeStartupError(fmt.Sprintf("Failed to initialize config: %v", err))
		log.Fatalf("failed to initialize config: %v", err)
	}

	if err := logger.InitFromEnv(); err != nil {
		writeStartupError(fmt.Sprintf("Failed to initialize logger: %v", err))
		log.Fatalf("failed to initialize logger: %v", err)
	}

	logger.Info("starting YANTA...")

	a, err := app.New(app.Config{DBPath: db.DefaultPath()})
	if err != nil {
		writeStartupError(fmt.Sprintf("Failed to create app: %v", err))
		logger.Fatalf("failed to create app: %v", err)
	}

	logger.Debug("application container created")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		sig := <-sigChan
		logger.Infof("received signal %v, shutting down gracefully...", sig)

		if a.DB != nil {
			logger.Info("checkpointing database before exit...")
			a.OnShutdown(context.Background())
		}

		logger.Info("shutdown complete, exiting")
		os.Exit(0)
	}()

	startHidden := config.GetStartHidden()
	logger.Infof("start_hidden config: %v", startHidden)

	frameless := runtime.GOOS == "linux"
	logger.Infof("platform: %s, frameless: %v", runtime.GOOS, frameless)

	err = wails.Run(&options.App{
		Title:       "YANTA",
		Width:       1024,
		Height:      768,
		Frameless:   frameless,
		StartHidden: startHidden,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					w.WriteHeader(http.StatusMethodNotAllowed)
					return
				}

				if !strings.HasPrefix(r.URL.Path, "/assets/") {
					w.WriteHeader(http.StatusNotFound)
					return
				}
				// We can't access app internals here; instead, re-open the vault on demand.
				// Minimal duplication: use internal packages.
				// WARNING: We avoid heavy logic here; path parsing & streaming only.
				parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/assets/"), "/")
				if len(parts) < 2 {
					w.WriteHeader(http.StatusNotFound)
					return
				}
				projectAlias := parts[0]
				file := parts[1]
				dot := strings.LastIndex(file, ".")
				if dot <= 0 {
					w.WriteHeader(http.StatusNotFound)
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
			}),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        a.OnStartup,
		OnBeforeClose:    a.OnBeforeClose,
		OnShutdown:       a.OnShutdown,
		Bind:             a.Bindings.Bind(),
		EnumBind:         a.Bindings.BindEnums(),
		Logger:           logger.NewWailsLogger(),
		Windows:          getWindowsOptions(),
		Mac:              getMacOptions(),
		Linux:            getLinuxOptions(),
	})

	if err != nil {
		writeStartupError(fmt.Sprintf("Failed to run Wails application: %v", err))
		logger.Errorf("failed to run Wails application: %v", err)
	}

	logger.Debug("Wails application exited")
}

func writeStartupError(message string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	errorFile := filepath.Join(home, ".yanta", "startup-error.log")
	f, err := os.OpenFile(errorFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), message)
}

func getWindowsOptions() *windows.Options {
	return &windows.Options{
		Theme: windows.SystemDefault,

		CustomTheme: &windows.ThemeSettings{
			DarkModeTitleBar:           windows.RGB(27, 38, 54),
			DarkModeTitleBarInactive:   windows.RGB(20, 29, 42),
			DarkModeTitleText:          windows.RGB(220, 220, 220),
			DarkModeTitleTextInactive:  windows.RGB(140, 140, 140),
			DarkModeBorder:             windows.RGB(40, 50, 65),
			DarkModeBorderInactive:     windows.RGB(30, 40, 50),
			LightModeTitleBar:          windows.RGB(245, 245, 245),
			LightModeTitleBarInactive:  windows.RGB(235, 235, 235),
			LightModeTitleText:         windows.RGB(30, 30, 30),
			LightModeTitleTextInactive: windows.RGB(120, 120, 120),
			LightModeBorder:            windows.RGB(210, 210, 210),
			LightModeBorderInactive:    windows.RGB(230, 230, 230),
		},

		BackdropType:         windows.Mica,
		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
	}
}

func getMacOptions() *mac.Options {
	return &mac.Options{
		TitleBar: &mac.TitleBar{
			TitlebarAppearsTransparent: true,
			HideTitle:                  true,
			FullSizeContent:            true,
			HideToolbarSeparator:       true,
		},

		Appearance: mac.NSAppearanceNameDarkAqua,

		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
	}
}

func getLinuxOptions() *linux.Options {
	return &linux.Options{}
}
