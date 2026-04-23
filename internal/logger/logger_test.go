package logger

import (
	"os"
	"path/filepath"
	"testing"
)

// TestTestRunsDoNotWriteToDefaultLogFile ensures `go test` runs never touch
// the user's ~/.yanta/logs/yanta.log. Regression guard for a bug where the
// test suite appended hundreds of "expected" error lines to the real log.
func TestTestRunsDoNotWriteToDefaultLogFile(t *testing.T) {
	// Unset any overrides so we hit the default path logic.
	t.Setenv("YANTA_LOG_DIR", "")
	t.Setenv("YANTA_LOG_FILE", "")

	if !isTestBinary() {
		t.Fatal("isTestBinary() returned false inside a go-test run")
	}

	cfg := DefaultConfig()
	if err := Init(cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer Close()

	// After Init, no file handle should be open.
	if logFile != nil {
		t.Fatalf("expected no log file to be opened under go test, got %s", logFile.Name())
	}

	// Emit a line; it must not create or grow the default yanta.log.
	defaultPath := filepath.Join(cfg.LogDir, "yanta.log")
	var sizeBefore int64 = -1
	if info, err := os.Stat(defaultPath); err == nil {
		sizeBefore = info.Size()
	}

	Error("this log line must not be written to the user's yanta.log")

	if info, err := os.Stat(defaultPath); err == nil {
		if sizeBefore >= 0 && info.Size() != sizeBefore {
			t.Fatalf("yanta.log grew during test run: before=%d after=%d", sizeBefore, info.Size())
		}
	}
}

func TestExplicitLogDirOverrideStillWritesFile(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("YANTA_LOG_DIR", tmp)
	t.Setenv("YANTA_LOG_FILE", "yanta.log")

	cfg := &Config{
		Level:   "info",
		LogFile: "yanta.log",
		LogDir:  tmp,
	}
	if err := Init(cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	defer Close()

	Info("explicit override should still write")

	p := filepath.Join(tmp, "yanta.log")
	info, err := os.Stat(p)
	if err != nil {
		t.Fatalf("expected log file at %s, got err: %v", p, err)
	}
	if info.Size() == 0 {
		t.Fatal("expected log file to have content when dir/file overrides are set")
	}
}
