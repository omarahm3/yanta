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
	// Paper & Ink — dark companion: graphite surface #232629, ink #E6E8EB.
	darkTitleBar  = rgb(35, 38, 41)
	darkTitleText = rgb(230, 232, 235)
	darkBorder    = rgb(51, 55, 60)

	// Paper & Ink — light lead: chrome #F4F6F8, ink #1A1C1F, hairline #E2E5EA.
	lightTitleBar  = rgb(244, 246, 248)
	lightTitleText = rgb(26, 28, 31)
	lightBorder    = rgb(226, 229, 234)
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
