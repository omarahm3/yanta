// Package mcpbridge implements the stdio<->HTTP relay that lets MCP clients
// which speak the stdio transport (Claude Code, Codex, opencode, ...) talk to a
// running Yanta app's loopback MCP server.
//
// It is invoked as `yanta mcp`: an agent spawns that as a stdio subprocess, and
// it reads the endpoint + bearer token from the discovery file Yanta writes when
// its MCP server is enabled, connects to that server as an MCP client, mirrors
// its tools, and re-serves them over stdio. If Yanta is not running (no
// reachable endpoint), it returns a clear error.
//
// The relay deliberately talks to the *running app* rather than opening the
// vault itself: that keeps a single in-process writer (shared SQLite connection,
// event bus, project cache, and git-sync lock), so external edits stay
// consistent with the UI.
package mcpbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"yanta/internal/config"
	"yanta/internal/system"
)

type discovery struct {
	URL   string `json:"url"`
	Token string `json:"token"`
	PID   int    `json:"pid"`
}

// Run connects to the running Yanta app's MCP server and relays it over stdio.
// It blocks until the client closes the stdio connection (or an error occurs).
func Run(ctx context.Context) error {
	disc, err := readDiscovery()
	if err != nil {
		return err
	}

	// Connect to the running Yanta MCP server as a client, injecting the bearer
	// token on every request.
	client := mcp.NewClient(&mcp.Implementation{Name: "yanta-mcp-bridge", Version: system.BuildVersion}, nil)
	transport := &mcp.StreamableClientTransport{
		Endpoint:   disc.URL,
		HTTPClient: &http.Client{Transport: &authTransport{token: disc.Token, base: http.DefaultTransport}},
	}
	upstream, err := client.Connect(ctx, transport, nil)
	if err != nil {
		// A stale discovery file (app crashed without cleaning up) points at a
		// dead endpoint. If its PID is gone, say so plainly instead of leaking a
		// raw connection-refused; otherwise fall back to the generic message.
		if disc.PID > 0 && !processAlive(disc.PID) {
			return fmt.Errorf("Yanta isn't running: %s references PID %d, which is gone (stale discovery file). Start Yanta and enable its MCP server (Settings → MCP Server)", config.MCPDiscoveryPath(), disc.PID)
		}
		return fmt.Errorf("cannot reach Yanta at %s — is the app running with its MCP server enabled? (%w)", disc.URL, err)
	}
	defer func() {
		_ = upstream.Close()
	}()

	// Mirror the upstream tools onto a stdio server, forwarding each call
	// through to the upstream session.
	server := mcp.NewServer(&mcp.Implementation{Name: "yanta", Version: system.BuildVersion}, nil)
	tools, err := upstream.ListTools(ctx, nil)
	if err != nil {
		return fmt.Errorf("listing upstream tools: %w", err)
	}
	for _, tool := range tools.Tools {
		server.AddTool(tool, forward(upstream, tool.Name))
	}

	return server.Run(ctx, &mcp.StdioTransport{})
}

// forward returns a handler that relays a tools/call straight to the upstream
// session, passing the raw arguments through untouched.
func forward(upstream *mcp.ClientSession, name string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return upstream.CallTool(ctx, &mcp.CallToolParams{
			Name:      name,
			Arguments: req.Params.Arguments,
		})
	}
}

type authTransport struct {
	token string
	base  http.RoundTripper
}

func (t *authTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+t.token)
	return t.base.RoundTrip(r)
}

func readDiscovery() (*discovery, error) {
	path := config.MCPDiscoveryPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("discovery file not found at %s — start Yanta and enable its MCP server (Settings → MCP Server, or [mcp].enabled = true)", path)
		}
		return nil, err
	}
	var d discovery
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}
	if d.URL == "" {
		return nil, fmt.Errorf("no url in %s", path)
	}
	if d.Token == "" {
		return nil, fmt.Errorf("no token in %s", path)
	}
	return &d, nil
}
