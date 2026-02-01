//go:build !windows

package hotkeys

import (
	"yanta/internal/config"
	"yanta/internal/logger"
)

// Manager handles global hotkey registration and lifecycle.
// This is a stub for non-Windows platforms.
type Manager struct {
	onQuickCapture func()
	onRestore      func()
}

// New creates a new hotkey Manager with the specified callbacks.
func New(onQuickCapture, onRestore func()) *Manager {
	return &Manager{
		onQuickCapture: onQuickCapture,
		onRestore:      onRestore,
	}
}

// Start is a no-op on non-Windows platforms.
func (m *Manager) Start(cfg config.HotkeyConfig) error {
	logger.Info("global hotkey registration is only supported on Windows")
	return nil
}

// Stop is a no-op on non-Windows platforms.
func (m *Manager) Stop() error {
	return nil
}

// Reconfigure is a no-op on non-Windows platforms.
func (m *Manager) Reconfigure(cfg config.HotkeyConfig) error {
	return nil
}

// IsRunning always returns false on non-Windows platforms.
func (m *Manager) IsRunning() bool {
	return false
}
