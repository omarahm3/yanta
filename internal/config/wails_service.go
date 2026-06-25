package config

import (
	"context"

	"github.com/wailsapp/wails/v3/pkg/application"

	"yanta/internal/events"
)

type WailsService struct {
	eventBus interface{ Emit(string, any) }
	window   *application.WebviewWindow
}

func NewWailsService() *WailsService {
	return &WailsService{}
}

// InitWailsService wires internal deps after the window and event bus are available.
// Package-level so Wails does not generate a frontend binding for it.
func InitWailsService(s *WailsService, eb interface{ Emit(string, any) }, w *application.WebviewWindow) {
	s.eventBus = eb
	s.window = w
}

func (s *WailsService) GetPreferencesOverrides(ctx context.Context) (PreferencesOverrides, error) {
	return GetPreferencesOverrides(), nil
}

func (s *WailsService) SetPreferencesOverrides(ctx context.Context, overrides PreferencesOverrides) error {
	oldTheme := GetTheme()
	if err := SetPreferencesOverrides(overrides); err != nil {
		return err
	}
	if newTheme := GetTheme(); newTheme != oldTheme {
		s.applyTheme(newTheme)
		s.emitTheme(newTheme)
	}
	return nil
}

func (s *WailsService) GetFeatureFlags(ctx context.Context) (FeatureFlags, error) {
	return GetFeatureFlags(), nil
}

// EmitCurrentTheme broadcasts the current theme — called on startup from app.go.
func (s *WailsService) EmitCurrentTheme() {
	s.emitTheme(GetTheme())
}

func (s *WailsService) applyTheme(theme string) {
	if s.window == nil {
		return
	}
	var bgColour application.RGBA
	switch theme {
	case ThemeLight:
		bgColour = application.NewRGBA(244, 246, 248, 255)
	default:
		bgColour = application.NewRGBA(35, 38, 41, 255)
	}
	s.window.SetBackgroundColour(bgColour)
	syncNativeWindowTheme(s.window, theme)
}

func (s *WailsService) emitTheme(theme string) {
	if s.eventBus != nil {
		s.eventBus.Emit(events.ThemeChanged, map[string]any{"theme": theme})
	}
}
