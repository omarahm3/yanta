// Package hotkeys provides global hotkey management for Yanta.
package hotkeys

import (
	"fmt"
	"strings"

	"golang.design/x/hotkey"
)

// Modifier string constants for configuration.
const (
	ModCtrlStr  = "Ctrl"
	ModShiftStr = "Shift"
	ModAltStr   = "Alt"
	ModWinStr   = "Win" // Windows key / Super / Command
)

// Key string constants for configuration.
// These are the keys we support for global hotkey registration.
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

// ParseModifier converts a string modifier to hotkey.Modifier.
func ParseModifier(s string) (hotkey.Modifier, error) {
	switch strings.ToLower(s) {
	case "ctrl", "control":
		return hotkey.ModCtrl, nil
	case "shift":
		return hotkey.ModShift, nil
	case "alt":
		return hotkey.ModAlt, nil
	case "win", "super", "cmd", "command", "meta":
		return hotkey.ModWin, nil
	default:
		return 0, fmt.Errorf("unknown modifier: %s", s)
	}
}

// ParseModifiers converts a slice of string modifiers to a slice of hotkey.Modifier.
func ParseModifiers(modifiers []string) ([]hotkey.Modifier, error) {
	result := make([]hotkey.Modifier, 0, len(modifiers))
	for _, m := range modifiers {
		mod, err := ParseModifier(m)
		if err != nil {
			return nil, err
		}
		result = append(result, mod)
	}
	return result, nil
}

// ParseKey converts a string key name to hotkey.Key.
func ParseKey(s string) (hotkey.Key, error) {
	upper := strings.ToUpper(s)

	// Letter keys A-Z
	if len(upper) == 1 && upper[0] >= 'A' && upper[0] <= 'Z' {
		// hotkey.Key values: KeyA = 'A', etc.
		return hotkey.Key(upper[0]), nil
	}

	// Number keys 0-9
	if len(upper) == 1 && upper[0] >= '0' && upper[0] <= '9' {
		return hotkey.Key(upper[0]), nil
	}

	// Function keys and special keys
	switch upper {
	case "F1":
		return hotkey.KeyF1, nil
	case "F2":
		return hotkey.KeyF2, nil
	case "F3":
		return hotkey.KeyF3, nil
	case "F4":
		return hotkey.KeyF4, nil
	case "F5":
		return hotkey.KeyF5, nil
	case "F6":
		return hotkey.KeyF6, nil
	case "F7":
		return hotkey.KeyF7, nil
	case "F8":
		return hotkey.KeyF8, nil
	case "F9":
		return hotkey.KeyF9, nil
	case "F10":
		return hotkey.KeyF10, nil
	case "F11":
		return hotkey.KeyF11, nil
	case "F12":
		return hotkey.KeyF12, nil
	case "SPACE", " ":
		return hotkey.KeySpace, nil
	case "ENTER", "RETURN":
		return hotkey.KeyReturn, nil
	case "ESCAPE", "ESC":
		return hotkey.KeyEscape, nil
	case "TAB":
		return hotkey.KeyTab, nil
	default:
		return 0, fmt.Errorf("unknown key: %s", s)
	}
}

// FormatModifier converts a hotkey.Modifier to its string representation.
func FormatModifier(mod hotkey.Modifier) string {
	switch mod {
	case hotkey.ModCtrl:
		return ModCtrlStr
	case hotkey.ModShift:
		return ModShiftStr
	case hotkey.ModAlt:
		return ModAltStr
	case hotkey.ModWin:
		return ModWinStr
	default:
		return "Unknown"
	}
}

// FormatKey converts a hotkey.Key to its string representation.
func FormatKey(key hotkey.Key) string {
	// Letter and number keys
	if key >= hotkey.Key('A') && key <= hotkey.Key('Z') {
		return string(rune(key))
	}
	if key >= hotkey.Key('0') && key <= hotkey.Key('9') {
		return string(rune(key))
	}

	// Function keys
	switch key {
	case hotkey.KeyF1:
		return "F1"
	case hotkey.KeyF2:
		return "F2"
	case hotkey.KeyF3:
		return "F3"
	case hotkey.KeyF4:
		return "F4"
	case hotkey.KeyF5:
		return "F5"
	case hotkey.KeyF6:
		return "F6"
	case hotkey.KeyF7:
		return "F7"
	case hotkey.KeyF8:
		return "F8"
	case hotkey.KeyF9:
		return "F9"
	case hotkey.KeyF10:
		return "F10"
	case hotkey.KeyF11:
		return "F11"
	case hotkey.KeyF12:
		return "F12"
	case hotkey.KeySpace:
		return "Space"
	case hotkey.KeyReturn:
		return "Enter"
	case hotkey.KeyEscape:
		return "Escape"
	case hotkey.KeyTab:
		return "Tab"
	default:
		return fmt.Sprintf("Key(%d)", key)
	}
}

// FormatHotkey creates a human-readable string from modifiers and key.
func FormatHotkey(modifiers []hotkey.Modifier, key hotkey.Key) string {
	parts := make([]string, 0, len(modifiers)+1)
	for _, mod := range modifiers {
		parts = append(parts, FormatModifier(mod))
	}
	parts = append(parts, FormatKey(key))
	return strings.Join(parts, "+")
}

// FormatHotkeyFromStrings creates a human-readable string from string modifiers and key.
func FormatHotkeyFromStrings(modifiers []string, key string) string {
	parts := make([]string, 0, len(modifiers)+1)
	parts = append(parts, modifiers...)
	parts = append(parts, key)
	return strings.Join(parts, "+")
}
