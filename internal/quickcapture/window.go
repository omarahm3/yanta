// Package quickcapture provides Quick Capture window management for Yanta.
// See PRD Section 7.2 for window specifications.
package quickcapture

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"yanta/internal/logger"
)

const (
	WindowWidth  = 500
	WindowHeight = 130
)

var (
	quickCaptureWindow *application.WebviewWindow
	windowMutex        sync.Mutex
	wailsApp           *application.App
)

// SetApp sets the Wails application reference for window creation.
func SetApp(app *application.App) {
	windowMutex.Lock()
	defer windowMutex.Unlock()
	wailsApp = app
}

// CreateWindow creates and returns a new Quick Capture window.
// The window is frameless, always-on-top, centered, and non-resizable per PRD specs.
func CreateWindow(app *application.App) *application.WebviewWindow {
	windowMutex.Lock()
	defer windowMutex.Unlock()

	// Close existing window if any
	if quickCaptureWindow != nil {
		logger.Debug("closing existing Quick Capture window")
		quickCaptureWindow.Close()
		quickCaptureWindow = nil
	}

	logger.Debug("creating Quick Capture window")

	quickCaptureWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:         "Quick Capture",
		Width:         WindowWidth,
		Height:        WindowHeight,
		MinWidth:      WindowWidth,
		MinHeight:     WindowHeight,
		Frameless:     true,
		AlwaysOnTop:   true,
		Hidden:        false,
		DisableResize: true,
		URL:           "/quick-capture",
		// Background color: #1B2636 from PRD Section 3.2
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		Mac: application.MacWindow{
			TitleBar:   application.MacTitleBarHidden,
			Appearance: application.NSAppearanceNameDarkAqua,
		},
		Windows: application.WindowsWindow{
			Theme: application.Dark,
		},
		Linux: application.LinuxWindow{
			WindowIsTranslucent: false,
			WebviewGpuPolicy:    application.WebviewGpuPolicyOnDemand,
		},
	})

	// Center the window after creation
	quickCaptureWindow.Center()

	// Register hook to clear reference when window is closed
	// This prevents trying to show a destroyed WebView2 window
	quickCaptureWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		logger.Debug("Quick Capture window closing")
		windowMutex.Lock()
		quickCaptureWindow = nil
		windowMutex.Unlock()
	})

	logger.Info("Quick Capture window created")
	return quickCaptureWindow
}

// ShowWindow shows and focuses the Quick Capture window.
// If no window exists, creates one first.
func ShowWindow() {
	windowMutex.Lock()
	defer windowMutex.Unlock()

	if quickCaptureWindow == nil {
		if wailsApp == nil {
			logger.Error("cannot show Quick Capture: app not set")
			return
		}
		// Need to unlock before creating window (CreateWindow takes lock)
		windowMutex.Unlock()
		CreateWindow(wailsApp)
		windowMutex.Lock()
	}

	if quickCaptureWindow != nil {
		quickCaptureWindow.Show()
		quickCaptureWindow.Focus()
		logger.Debug("Quick Capture window shown and focused")
	}
}

// CloseWindow closes the Quick Capture window.
func CloseWindow() {
	windowMutex.Lock()
	defer windowMutex.Unlock()

	if quickCaptureWindow != nil {
		quickCaptureWindow.Close()
		quickCaptureWindow = nil
		logger.Debug("Quick Capture window closed")
	}
}

// IsWindowOpen returns true if the Quick Capture window exists and is open.
func IsWindowOpen() bool {
	windowMutex.Lock()
	defer windowMutex.Unlock()
	return quickCaptureWindow != nil
}
