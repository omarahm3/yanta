package mcpctl

import (
	"context"
	"os"
	"time"

	"yanta/internal/config"
)

// Service is the Wails-bindable control surface for the MCP server, backed by a
// Manager. Its exported ctx-first methods become frontend bindings.
type Service struct {
	mgr *Manager
}

func NewService(mgr *Manager) *Service { return &Service{mgr: mgr} }

// GetStatus reports the current MCP server state.
func (s *Service) GetStatus(ctx context.Context) Status {
	return s.mgr.Status()
}

// SetEnabled persists the enabled flag and starts or stops the server to match.
func (s *Service) SetEnabled(ctx context.Context, enabled bool) (Status, error) {
	cfg := config.GetMCPConfig()
	cfg.Enabled = enabled
	if err := config.SetMCPConfig(cfg); err != nil {
		return s.mgr.Status(), err
	}
	if enabled {
		if err := s.mgr.Start(); err != nil {
			return s.mgr.Status(), err
		}
	} else {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := s.mgr.Stop(shutdownCtx); err != nil {
			return s.mgr.Status(), err
		}
	}
	return s.mgr.Status(), nil
}

// SetPort persists a new port and restarts the server if it is running.
func (s *Service) SetPort(ctx context.Context, port int) (Status, error) {
	cfg := config.GetMCPConfig()
	cfg.Port = port
	if err := config.SetMCPConfig(cfg); err != nil {
		return s.mgr.Status(), err
	}
	if err := s.restartIfRunning(); err != nil {
		return s.mgr.Status(), err
	}
	return s.mgr.Status(), nil
}

// RegenerateToken discards the current token and restarts the server (if
// running) so the new token takes effect.
func (s *Service) RegenerateToken(ctx context.Context) (Status, error) {
	if err := os.Remove(tokenPath()); err != nil && !os.IsNotExist(err) {
		return s.mgr.Status(), err
	}
	if err := s.restartIfRunning(); err != nil {
		return s.mgr.Status(), err
	}
	return s.mgr.Status(), nil
}

func (s *Service) restartIfRunning() error {
	if !s.mgr.isRunning() {
		return nil
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := s.mgr.Stop(shutdownCtx); err != nil {
		return err
	}
	return s.mgr.Start()
}
