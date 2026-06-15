//go:build !windows

package config

import "github.com/wailsapp/wails/v3/pkg/application"

func syncNativeWindowTheme(_ *application.WebviewWindow, _ string) {}
