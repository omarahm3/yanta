package hotkeys

import (
	"runtime"
	"sync"
	"time"

	"golang.design/x/hotkey"

	"yanta/internal/config"
	"yanta/internal/logger"
)

// Manager handles global hotkey registration and lifecycle.
type Manager struct {
	mu sync.Mutex

	// Current hotkey registrations
	quickCaptureHK *hotkey.Hotkey
	restoreHK      *hotkey.Hotkey

	// Callbacks
	onQuickCapture func()
	onRestore      func()

	// State
	running bool
	stopCh  chan struct{}
}

// New creates a new hotkey Manager with the specified callbacks.
func New(onQuickCapture, onRestore func()) *Manager {
	return &Manager{
		onQuickCapture: onQuickCapture,
		onRestore:      onRestore,
	}
}

// Start registers hotkeys based on the provided configuration.
// Only works on Windows; returns nil without action on other platforms.
func (m *Manager) Start(cfg config.HotkeyConfig) error {
	if runtime.GOOS != "windows" {
		logger.Info("global hotkey registration is only supported on Windows")
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return nil
	}

	m.stopCh = make(chan struct{})
	m.running = true

	// Register Quick Capture hotkey if enabled
	if cfg.QuickCaptureEnabled && m.onQuickCapture != nil {
		if err := m.registerQuickCapture(cfg); err != nil {
			logger.Errorf("failed to register Quick Capture hotkey: %v", err)
			// Continue - don't fail the entire start
		}
	}

	// Register restore window hotkey (Ctrl+Shift+Y, always enabled on Windows)
	if m.onRestore != nil {
		if err := m.registerRestore(); err != nil {
			logger.Errorf("failed to register restore hotkey: %v", err)
		}
	}

	return nil
}

// registerQuickCapture registers the Quick Capture hotkey in a goroutine.
func (m *Manager) registerQuickCapture(cfg config.HotkeyConfig) error {
	mods, err := ParseModifiers(cfg.QuickCaptureModifiers)
	if err != nil {
		return err
	}

	key, err := ParseKey(cfg.QuickCaptureKey)
	if err != nil {
		return err
	}

	go func() {
		hk := hotkey.New(mods, key)
		if err := hk.Register(); err != nil {
			logger.Errorf("failed to register Quick Capture hotkey %s: %v",
				FormatHotkeyFromStrings(cfg.QuickCaptureModifiers, cfg.QuickCaptureKey), err)
			return
		}

		m.mu.Lock()
		m.quickCaptureHK = hk
		m.mu.Unlock()

		hotkeyStr := FormatHotkeyFromStrings(cfg.QuickCaptureModifiers, cfg.QuickCaptureKey)
		logger.Infof("registered Quick Capture hotkey: %s", hotkeyStr)

		for {
			select {
			case <-m.stopCh:
				return
			case <-hk.Keydown():
				logger.Debug("Quick Capture hotkey pressed")
				if m.onQuickCapture != nil {
					m.onQuickCapture()
				}
			}
		}
	}()

	return nil
}

// registerRestore registers the restore window hotkey (Ctrl+Shift+Y).
func (m *Manager) registerRestore() error {
	go func() {
		hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.Key('Y'))
		if err := hk.Register(); err != nil {
			logger.Errorf("failed to register restore hotkey Ctrl+Shift+Y: %v", err)
			return
		}

		m.mu.Lock()
		m.restoreHK = hk
		m.mu.Unlock()

		logger.Info("registered restore hotkey: Ctrl+Shift+Y")

		for {
			select {
			case <-m.stopCh:
				return
			case <-hk.Keydown():
				logger.Debug("restore hotkey pressed")
				if m.onRestore != nil {
					m.onRestore()
				}
			}
		}
	}()

	return nil
}

// Stop unregisters all hotkeys and stops the manager.
func (m *Manager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return nil
	}

	logger.Debug("stopping hotkey manager")

	// Signal goroutines to stop
	close(m.stopCh)
	m.running = false

	// Unregister hotkeys with timeout
	m.unregisterWithTimeout(m.quickCaptureHK, "Quick Capture")
	m.unregisterWithTimeout(m.restoreHK, "restore")

	m.quickCaptureHK = nil
	m.restoreHK = nil

	logger.Debug("hotkey manager stopped")
	return nil
}

// unregisterWithTimeout attempts to unregister a hotkey with a timeout.
func (m *Manager) unregisterWithTimeout(hk *hotkey.Hotkey, name string) {
	if hk == nil {
		return
	}

	done := make(chan struct{})
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Errorf("panic during %s hotkey unregister: %v", name, r)
			}
			close(done)
		}()
		if err := hk.Unregister(); err != nil {
			logger.Errorf("failed to unregister %s hotkey: %v", name, err)
		}
	}()

	select {
	case <-done:
		logger.Debugf("%s hotkey unregistered", name)
	case <-time.After(500 * time.Millisecond):
		logger.Warnf("%s hotkey unregister timeout", name)
	}
}

// Reconfigure updates the hotkey configuration at runtime.
// It stops existing hotkeys and re-registers with the new config.
func (m *Manager) Reconfigure(cfg config.HotkeyConfig) error {
	if runtime.GOOS != "windows" {
		return nil
	}

	logger.Info("reconfiguring hotkeys")

	// Stop current registrations
	if err := m.Stop(); err != nil {
		logger.Errorf("error stopping hotkeys during reconfigure: %v", err)
	}

	// Small delay to ensure resources are released
	time.Sleep(100 * time.Millisecond)

	// Start with new config
	return m.Start(cfg)
}

// IsRunning returns true if the manager is currently running.
func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}
