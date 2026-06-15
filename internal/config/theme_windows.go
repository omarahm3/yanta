//go:build windows

package config

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/w32"
)

// syncNativeWindowTheme repaints the Windows title bar to match the selected
// theme. Wails only applies the title-bar theme at window creation and on OS
// theme-change events, so an in-app switch needs this manual nudge.
func syncNativeWindowTheme(window *application.WebviewWindow, theme string) {
	if window == nil {
		return
	}
	isDark := theme == ThemeDark || (theme != ThemeLight && w32.IsCurrentlyDarkMode())
	application.InvokeAsync(func() {
		hwnd := uintptr(window.NativeWindow())
		if hwnd == 0 {
			return
		}
		w32.SetTheme(hwnd, isDark)
	})
}
