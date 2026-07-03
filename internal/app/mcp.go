package app

import "context"

// StartMCPIfEnabled starts the MCP server if it is enabled in config. Called at
// boot. Safe to call when the manager was not constructed.
func (a *App) StartMCPIfEnabled() error {
	if a.mcpManager == nil {
		return nil
	}
	return a.mcpManager.StartIfEnabled()
}

// StopMCP stops the MCP server if it is running.
func (a *App) StopMCP(ctx context.Context) error {
	if a.mcpManager == nil {
		return nil
	}
	return a.mcpManager.Stop(ctx)
}
