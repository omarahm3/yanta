// Command yanta-mcp is a thin stdio<->HTTP bridge that lets MCP clients which
// speak the stdio transport (Claude Code, Codex, opencode, ...) talk to a
// running Yanta app's loopback MCP server.
//
// Register it with your agent, e.g.:
//
//	claude mcp add yanta -- yanta-mcp
//
// It reads the endpoint and bearer token from $YANTA_HOME/mcp.json (written by
// Yanta when its MCP server is enabled), connects to that server as an MCP
// client, mirrors the server's tools, and re-serves them over stdio. If Yanta
// is not running (no reachable endpoint), it exits with a clear error.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type discovery struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "yanta-mcp: "+err.Error())
		os.Exit(1)
	}
}

func run() error {
	disc, err := readDiscovery()
	if err != nil {
		return err
	}

	ctx := context.Background()

	// Connect to the running Yanta MCP server as a client, injecting the bearer
	// token on every request.
	client := mcp.NewClient(&mcp.Implementation{Name: "yanta-mcp-bridge", Version: "dev"}, nil)
	transport := &mcp.StreamableClientTransport{
		Endpoint:   disc.URL,
		HTTPClient: &http.Client{Transport: &authTransport{token: disc.Token, base: http.DefaultTransport}},
	}
	upstream, err := client.Connect(ctx, transport, nil)
	if err != nil {
		return fmt.Errorf("cannot reach Yanta at %s — is the app running with its MCP server enabled? (%w)", disc.URL, err)
	}
	defer upstream.Close()

	// Mirror the upstream tools onto a stdio server, forwarding each call
	// through to the upstream session.
	server := mcp.NewServer(&mcp.Implementation{Name: "yanta", Version: "dev"}, nil)
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
	path := discoveryPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("discovery file not found at %s — start Yanta and enable its MCP server ([mcp].enabled = true)", path)
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
	return &d, nil
}

func discoveryPath() string {
	root := os.Getenv("YANTA_HOME")
	if root == "" {
		if home, err := os.UserHomeDir(); err == nil {
			root = filepath.Join(home, ".yanta")
		}
	}
	return filepath.Join(root, "mcp.json")
}
