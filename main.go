package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
	"yanta/internal/app"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/logger"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
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

	// Check if app should start hidden
	startHidden := config.GetStartHidden()
	logger.Infof("start_hidden config: %v", startHidden)

	err = wails.Run(&options.App{
		Title:        "YANTA",
		Width:        1024,
		Height:       768,
		Frameless:    true,
		StartHidden:  startHidden, // Respect user setting (defaults to false)
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        a.OnStartup,
		OnBeforeClose:    a.OnBeforeClose,
		OnShutdown:       a.OnShutdown,
		Bind:             a.Bindings.Bind(),
		EnumBind:         a.Bindings.BindEnums(),
		Logger:           logger.NewWailsLogger(),
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
