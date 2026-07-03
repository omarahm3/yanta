// Package mcpctl provides runtime lifecycle control for Yanta's MCP server —
// starting, stopping, and reporting status. It bridges the transport-agnostic
// internal/mcp server to the app's config and discovery-file conventions, and
// exposes a Wails-bindable Service so the Settings UI can drive it at runtime.
package mcpctl

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
	"strings"
	"sync"
	"time"

	"yanta/internal/config"
	"yanta/internal/logger"
	"yanta/internal/mcp"
	"yanta/internal/system"
)

// defaultPort is used when [mcp].port is unset. A fixed default keeps the client
// setup command and the URL in mcp.json stable across restarts.
const defaultPort = 47600

// Status is the MCP server state reported to the frontend.
type Status struct {
	Enabled bool   `json:"enabled"`
	Running bool   `json:"running"`
	URL     string `json:"url"`
	Port    int    `json:"port"`
	Token   string `json:"token"`
	Error   string `json:"error,omitempty"`
}

// Manager owns the MCP HTTP server lifecycle. All methods are safe for
// concurrent use.
type Manager struct {
	vault   mcp.Vault
	version string

	mu      sync.Mutex
	httpSrv *http.Server
	running bool
	url     string
	port    int
	token   string
	lastErr string
}

func NewManager(vault mcp.Vault) *Manager {
	return &Manager{vault: vault, version: system.BuildVersion}
}

// StartIfEnabled starts the server when config has it enabled. Used at boot.
func (m *Manager) StartIfEnabled() error {
	if !config.GetMCPConfig().Enabled {
		// Clear any discovery file a previous run left behind (e.g. after a
		// crash) so `yanta mcp` doesn't try to reach a server that isn't there.
		_ = os.Remove(discoveryPath())
		logger.Debug("MCP server disabled (enable in Settings or set YANTA_ENABLE_MCP=1)")
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.startLocked()
}

// Start starts the server; a no-op if already running.
func (m *Manager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.startLocked()
}

func (m *Manager) startLocked() error {
	if m.running {
		return nil
	}

	cfg := config.GetMCPConfig()
	port := cfg.Port
	if port <= 0 {
		port = defaultPort
	}

	token, err := loadOrCreateToken()
	if err != nil {
		m.lastErr = err.Error()
		return fmt.Errorf("mcp: preparing auth token: %w", err)
	}

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		m.lastErr = fmt.Sprintf("could not bind %s: %v", addr, err)
		return fmt.Errorf("mcp: listening on %s: %w", addr, err)
	}

	url := fmt.Sprintf("http://%s/", ln.Addr().String())
	if err := writeDiscovery(url, token); err != nil {
		_ = ln.Close()
		m.lastErr = err.Error()
		return fmt.Errorf("mcp: writing discovery file: %w", err)
	}

	srv := mcp.NewServer(m.vault, m.version)
	httpSrv := &http.Server{Handler: srv.Handler(token), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		logger.Infof("MCP server listening on %s", url)
		if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
			logger.Errorf("MCP server stopped with error: %v", err)
		}
	}()

	m.httpSrv = httpSrv
	m.running = true
	m.url = url
	m.port = port
	m.token = token
	m.lastErr = ""
	return nil
}

// Stop shuts the server down (a no-op if not running) and removes the discovery
// file.
func (m *Manager) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stopLocked(ctx)
}

func (m *Manager) stopLocked(ctx context.Context) error {
	if !m.running {
		return nil
	}
	_ = os.Remove(discoveryPath())
	err := m.httpSrv.Shutdown(ctx)
	m.httpSrv = nil
	m.running = false
	m.url = ""
	m.token = ""
	return err
}

// Status returns the current server state.
func (m *Manager) Status() Status {
	m.mu.Lock()
	defer m.mu.Unlock()

	port := m.port
	if !m.running {
		port = config.GetMCPConfig().Port
		if port <= 0 {
			port = defaultPort
		}
	}
	return Status{
		Enabled: config.GetMCPConfig().Enabled,
		Running: m.running,
		URL:     m.url,
		Port:    port,
		Token:   m.token,
		Error:   m.lastErr,
	}
}

func (m *Manager) isRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// --- discovery + token helpers ---

func discoveryPath() string { return config.MCPDiscoveryPath() }
func tokenPath() string     { return filepath.Join(config.GetAppRootDirectory(), "mcp-token") }

func loadOrCreateToken() (string, error) {
	p := tokenPath()
	if b, err := os.ReadFile(p); err == nil {
		// Tolerate a trailing newline/whitespace if the file was hand-edited;
		// the token is compared verbatim against the client's bearer header.
		if tok := strings.TrimSpace(string(b)); len(tok) >= 32 {
			return tok, nil
		}
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

func writeDiscovery(url, token string) error {
	data, err := json.MarshalIndent(map[string]any{
		"url":   url,
		"token": token,
		"pid":   os.Getpid(),
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(discoveryPath(), data, 0o600)
}
