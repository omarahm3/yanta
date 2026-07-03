package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"time"

	"yanta/internal/config"
	"yanta/internal/logger"
	"yanta/internal/mcp"
)

// defaultMCPPort is used when [mcp].port is unset. A fixed default keeps the
// client setup command (and the URL in mcp.json) stable across restarts.
const defaultMCPPort = 47600

// StartMCPServer starts the loopback MCP HTTP server if enabled in config.
// It returns a stop function (always non-nil) that shuts the server down and
// removes the discovery file. When MCP is disabled the stop function is a
// no-op. The MCP server reuses the app's live services, so external writes stay
// coherent with the running GUI.
func (a *App) StartMCPServer() (func(context.Context) error, error) {
	noop := func(context.Context) error { return nil }

	cfg := config.GetMCPConfig()
	if !cfg.Enabled {
		logger.Debug("MCP server disabled (set [mcp].enabled = true or YANTA_ENABLE_MCP=1 to enable)")
		return noop, nil
	}

	port := cfg.Port
	if port <= 0 {
		port = defaultMCPPort
	}

	token, err := loadOrCreateMCPToken()
	if err != nil {
		return noop, fmt.Errorf("mcp: preparing auth token: %w", err)
	}

	srv := mcp.NewServer(a.mcpVault, appVersion())

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return noop, fmt.Errorf("mcp: listening on %s: %w", addr, err)
	}

	url := fmt.Sprintf("http://%s/", ln.Addr().String())
	if err := writeMCPDiscovery(url, token); err != nil {
		_ = ln.Close()
		return noop, fmt.Errorf("mcp: writing discovery file: %w", err)
	}

	httpSrv := &http.Server{
		Handler:           srv.Handler(token),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		logger.Infof("MCP server listening on %s", url)
		if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
			logger.Errorf("MCP server stopped with error: %v", err)
		}
	}()

	stop := func(ctx context.Context) error {
		_ = os.Remove(mcpDiscoveryPath())
		return httpSrv.Shutdown(ctx)
	}
	return stop, nil
}

func mcpDiscoveryPath() string {
	return filepath.Join(config.GetAppRootDirectory(), "mcp.json")
}

func mcpTokenPath() string {
	return filepath.Join(config.GetAppRootDirectory(), "mcp-token")
}

// loadOrCreateMCPToken returns a persistent bearer token, creating one on first
// use. Persisting it (0600) keeps the token stable across restarts so client
// configuration does not need to change each session.
func loadOrCreateMCPToken() (string, error) {
	p := mcpTokenPath()
	if b, err := os.ReadFile(p); err == nil && len(b) >= 32 {
		return string(b), nil
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := hex.EncodeToString(buf)
	if err := os.WriteFile(p, []byte(token), 0o600); err != nil {
		return "", err
	}
	return token, nil
}

// writeMCPDiscovery writes the endpoint and token to mcp.json (0600) so the
// yanta-mcp shim (and direct HTTP clients) can find and authenticate to the
// running server.
func writeMCPDiscovery(url, token string) error {
	data, err := json.MarshalIndent(map[string]any{
		"url":   url,
		"token": token,
		"pid":   os.Getpid(),
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(mcpDiscoveryPath(), data, 0o600)
}

func appVersion() string {
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" && info.Main.Version != "(devel)" {
		return info.Main.Version
	}
	return "dev"
}
