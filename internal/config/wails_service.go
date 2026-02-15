package config

import "context"

// WailsService exposes preferences overrides to the frontend via Wails bindings.
type WailsService struct{}

// NewWailsService creates a new Wails-compatible config service.
func NewWailsService() *WailsService {
	return &WailsService{}
}

// GetPreferencesOverrides returns the current user preferences overrides.
func (s *WailsService) GetPreferencesOverrides(ctx context.Context) (PreferencesOverrides, error) {
	return GetPreferencesOverrides(), nil
}

// SetPreferencesOverrides validates and saves the given overrides.
func (s *WailsService) SetPreferencesOverrides(ctx context.Context, overrides PreferencesOverrides) error {
	return SetPreferencesOverrides(overrides)
}

// GetFeatureFlags returns resolved feature flags (env overrides config values).
func (s *WailsService) GetFeatureFlags(ctx context.Context) (FeatureFlags, error) {
	return GetFeatureFlags(), nil
}
