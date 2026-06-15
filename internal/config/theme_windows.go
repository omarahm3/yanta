//go:build windows

package config

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/w32"
)

// Caption palette mirrors the custom theme in main.go. Setting only the
// immersive dark-mode flag isn't enough: an explicit DwmwaCaptionColor (set at
// window creation) overrides it, so the bar must be recoloured on every switch.
func rgb(r, g, b uint8) uint32 { return uint32(r) | uint32(g)<<8 | uint32(b)<<16 }

var (
	darkTitleBar  = rgb(27, 38, 54)
	darkTitleText = rgb(220, 220, 220)
	darkBorder    = rgb(40, 50, 65)

	lightTitleBar  = rgb(245, 245, 245)
	lightTitleText = rgb(30, 30, 30)
	lightBorder    = rgb(210, 210, 210)
)

// syncNativeWindowTheme repaints the Windows title bar to match the selected
// theme. Wails applies the title-bar theme only at window creation and on OS
// theme-change events, so an in-app switch needs this manual nudge.
func syncNativeWindowTheme(window *application.WebviewWindow, theme string) {
	if window == nil {
		return
	}
	isDark := theme == ThemeDark || (theme != ThemeLight && w32.IsCurrentlyDarkMode())
	application.InvokeAsync(func() {
		ptr := window.NativeWindow()
		if ptr == nil {
			return
		}
		handle := uintptr(ptr)
		hwnd := w32.HWND(handle)

		w32.SetTheme(handle, isDark)

		titleBar, text, border := lightTitleBar, lightTitleText, lightBorder
		if isDark {
			titleBar, text, border = darkTitleBar, darkTitleText, darkBorder
		}
		w32.SetTitleBarColour(hwnd, titleBar)
		w32.SetTitleTextColour(hwnd, text)
		w32.SetBorderColour(hwnd, border)
		w32.InvalidateRect(hwnd, nil, true)
	})
}
