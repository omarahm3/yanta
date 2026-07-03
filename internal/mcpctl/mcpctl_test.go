package mcpctl

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"testing"

	"yanta/internal/config"
)

// freePort returns a currently-free localhost TCP port.
func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

// setup isolates config in a temp YANTA_HOME with a known MCP config.
func setup(t *testing.T, enabled bool, port int) {
	t.Helper()
	t.Setenv("YANTA_HOME", t.TempDir())
	t.Setenv("YANTA_ENABLE_MCP", "") // ensure the env override is off
	config.ResetForTesting()
	if err := config.SetMCPConfig(config.MCPConfig{Enabled: enabled, Port: port}); err != nil {
		t.Fatal(err)
	}
}

func TestManagerStartStop(t *testing.T) {
	port := freePort(t)
	setup(t, true, port)

	m := NewManager(nil) // lifecycle only; tools are never invoked, so a nil vault is fine
	if err := m.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	st := m.Status()
	if !st.Running {
		t.Error("expected Running after Start")
	}
	if st.URL == "" || st.Port != port {
		t.Errorf("unexpected status: %+v", st)
	}
	discovery := filepath.Join(config.GetAppRootDirectory(), "mcp.json")
	if _, err := os.Stat(discovery); err != nil {
		t.Errorf("expected mcp.json to exist: %v", err)
	}

	if err := m.Stop(context.Background()); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if m.Status().Running {
		t.Error("expected not Running after Stop")
	}
	if _, err := os.Stat(discovery); !os.IsNotExist(err) {
		t.Error("expected mcp.json to be removed after Stop")
	}
}

func TestManagerStartIsIdempotent(t *testing.T) {
	setup(t, true, freePort(t))
	m := NewManager(nil)
	if err := m.Start(); err != nil {
		t.Fatal(err)
	}
	if err := m.Start(); err != nil { // second Start is a no-op
		t.Fatalf("second Start should be a no-op, got %v", err)
	}
	_ = m.Stop(context.Background())
}

func TestServiceSetEnabledTogglesLifecycle(t *testing.T) {
	setup(t, false, freePort(t))

	s := NewService(NewManager(nil))
	ctx := context.Background()

	st, err := s.SetEnabled(ctx, true)
	if err != nil {
		t.Fatalf("SetEnabled(true): %v", err)
	}
	if !st.Running || !st.Enabled {
		t.Errorf("expected running+enabled: %+v", st)
	}
	if !config.GetMCPConfig().Enabled {
		t.Error("enabled flag not persisted to config")
	}

	st, err = s.SetEnabled(ctx, false)
	if err != nil {
		t.Fatalf("SetEnabled(false): %v", err)
	}
	if st.Running || st.Enabled {
		t.Errorf("expected stopped+disabled: %+v", st)
	}
	if config.GetMCPConfig().Enabled {
		t.Error("disabled flag not persisted to config")
	}
}

func TestStatusWhenStoppedUsesDefaultPort(t *testing.T) {
	setup(t, false, 0)
	st := NewManager(nil).Status()
	if st.Running {
		t.Error("expected not running")
	}
	if st.Port != defaultPort {
		t.Errorf("expected default port %d, got %d", defaultPort, st.Port)
	}
}
