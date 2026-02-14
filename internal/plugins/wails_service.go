package plugins

import "context"

// WailsService exposes plugin metadata and lifecycle state via Wails bindings.
type WailsService struct {
	svc *Service
}

func NewWailsService(svc *Service) *WailsService {
	return &WailsService{svc: svc}
}

func (s *WailsService) ListInstalled(ctx context.Context) ([]InstallRecord, error) {
	return s.svc.ListInstalled()
}

func (s *WailsService) ScanLocalPlugins(ctx context.Context) ([]InstallRecord, error) {
	return s.svc.ScanLocalPlugins()
}

func (s *WailsService) GetPluginState(ctx context.Context, id string) (State, error) {
	return s.svc.GetPluginState(id)
}

func (s *WailsService) SetPluginEnabled(ctx context.Context, id string, enabled bool) error {
	return s.svc.SetPluginEnabled(id, enabled)
}

func (s *WailsService) GetCommunityPluginsEnabled(ctx context.Context) bool {
	return s.svc.GetCommunityPluginsEnabled()
}

func (s *WailsService) SetCommunityPluginsEnabled(ctx context.Context, enabled bool) error {
	return s.svc.SetCommunityPluginsEnabled(enabled)
}

func (s *WailsService) InstallFromDirectory(ctx context.Context, sourcePath string) (InstallRecord, error) {
	return s.svc.InstallFromDirectory(sourcePath)
}

func (s *WailsService) InstallFromPackage(ctx context.Context, sourcePath string) (InstallRecord, error) {
	return s.svc.InstallFromPackage(sourcePath)
}

func (s *WailsService) Uninstall(ctx context.Context, pluginID string) error {
	return s.svc.Uninstall(pluginID)
}

func (s *WailsService) GetPluginDirectory(ctx context.Context) (string, error) {
	return s.svc.GetPluginDirectory()
}

func (s *WailsService) ReadPluginEntrypoint(ctx context.Context, pluginID string) (string, error) {
	return s.svc.ReadPluginEntrypoint(pluginID)
}

func (s *WailsService) GetSupportedPluginAPIMajor(ctx context.Context) int {
	return SupportedPluginAPIMajor
}

func (s *WailsService) ListTrustedPublisherKeys(ctx context.Context) ([]TrustedPublisherKey, error) {
	return s.svc.ListTrustedPublisherKeys()
}

func (s *WailsService) AddTrustedPublisherKey(
	ctx context.Context,
	keyID string,
	publisherID string,
	publicKey string,
) error {
	return s.svc.AddTrustedPublisherKey(keyID, publisherID, publicKey)
}

func (s *WailsService) RemoveTrustedPublisherKey(ctx context.Context, keyID string) error {
	return s.svc.RemoveTrustedPublisherKey(keyID)
}
