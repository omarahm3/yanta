//go:build !windows

// Package hotkeys provides global hotkey management for Yanta.
// This is a stub for non-Windows platforms where global hotkeys are not supported.
package hotkeys

import (
	"fmt"
	"strings"
)

// Modifier string constants for configuration.
const (
	ModCtrlStr  = "Ctrl"
	ModShiftStr = "Shift"
	ModAltStr   = "Alt"
	ModWinStr   = "Win"
)

// SupportedKeys lists the keys supported for global hotkey registration.
var SupportedKeys = []string{
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
	"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	"F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
	"Space", "Enter", "Escape", "Tab",
}

// SupportedModifiers returns the list of supported modifier keys.
var SupportedModifiers = []string{
	ModCtrlStr,
	ModShiftStr,
	ModAltStr,
	ModWinStr,
}

// StubModifier is a placeholder type for non-Windows platforms.
type StubModifier int

// StubKey is a placeholder type for non-Windows platforms.
type StubKey int

// ParseModifier is a stub that returns an error on non-Windows platforms.
func ParseModifier(s string) (StubModifier, error) {
	return 0, fmt.Errorf("hotkeys not supported on this platform")
}

// ParseModifiers is a stub that returns an error on non-Windows platforms.
func ParseModifiers(modifiers []string) ([]StubModifier, error) {
	return nil, fmt.Errorf("hotkeys not supported on this platform")
}

// ParseKey is a stub that returns an error on non-Windows platforms.
func ParseKey(s string) (StubKey, error) {
	return 0, fmt.Errorf("hotkeys not supported on this platform")
}

// FormatModifier is a stub for non-Windows platforms.
func FormatModifier(mod StubModifier) string {
	return "Unknown"
}

// FormatKey is a stub for non-Windows platforms.
func FormatKey(key StubKey) string {
	return "Unknown"
}

// FormatHotkey is a stub for non-Windows platforms.
func FormatHotkey(modifiers []StubModifier, key StubKey) string {
	return "Unsupported"
}

// FormatHotkeyFromStrings creates a human-readable string from string modifiers and key.
func FormatHotkeyFromStrings(modifiers []string, key string) string {
	parts := make([]string, 0, len(modifiers)+1)
	parts = append(parts, modifiers...)
	parts = append(parts, key)
	return strings.Join(parts, "+")
}
