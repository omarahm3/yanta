package app

import (
	"testing"

	"yanta/internal/config"
	"yanta/internal/testenv"
)

func TestResolveEffectiveMode(t *testing.T) {
	tempDir := t.TempDir()
	cleanupDataDir := testenv.SetTestDataDir(t, tempDir)
	defer cleanupDataDir()
	clearAutoFallbackFlag()
	defer clearAutoFallbackFlag()

	t.Run("explicit modes are returned as-is", func(t *testing.T) {
		if got := resolveEffectiveMode(config.LinuxGraphicsModeNative, true, true); got != config.LinuxGraphicsModeNative {
			t.Fatalf("expected native, got %s", got)
		}
		if got := resolveEffectiveMode(config.LinuxGraphicsModeCompat, true, false); got != config.LinuxGraphicsModeCompat {
			t.Fatalf("expected compat, got %s", got)
		}
		if got := resolveEffectiveMode(config.LinuxGraphicsModeSoftware, true, false); got != config.LinuxGraphicsModeSoftware {
			t.Fatalf("expected software, got %s", got)
		}
	})

	t.Run("auto on non-nvidia-wayland stays native", func(t *testing.T) {
		clearAutoFallbackFlag()
		got := resolveEffectiveMode(config.LinuxGraphicsModeAuto, false, true)
		if got != config.LinuxGraphicsModeNative {
			t.Fatalf("expected native, got %s", got)
		}
	})

	t.Run("auto with previous incomplete startup falls back to compat and sets flag", func(t *testing.T) {
		clearAutoFallbackFlag()
		got := resolveEffectiveMode(config.LinuxGraphicsModeAuto, true, true)
		if got != config.LinuxGraphicsModeCompat {
			t.Fatalf("expected compat, got %s", got)
		}
		if !hasAutoFallbackFlag() {
			t.Fatalf("expected auto fallback flag to be set")
		}
	})

	t.Run("auto with fallback flag uses compat", func(t *testing.T) {
		setAutoFallbackFlag()
		got := resolveEffectiveMode(config.LinuxGraphicsModeAuto, true, false)
		if got != config.LinuxGraphicsModeCompat {
			t.Fatalf("expected compat, got %s", got)
		}
	})
}
