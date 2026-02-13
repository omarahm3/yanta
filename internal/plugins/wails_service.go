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

func (s *WailsService) GetPluginDirectory(ctx context.Context) (string, error) {
	return s.svc.GetPluginDirectory()
}
