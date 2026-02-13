package app

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"

	"yanta/internal/config"
	"yanta/internal/logger"
)

type GraphicsRuntimeState struct {
	ConfiguredMode string
	EffectiveMode  string
	FallbackActive bool
	FallbackReason string
	GpuPolicy      application.WebviewGpuPolicy
}

var graphicsRuntimeState = GraphicsRuntimeState{
	ConfiguredMode: config.LinuxGraphicsModeAuto,
	EffectiveMode:  config.LinuxGraphicsModeNative,
	GpuPolicy:      application.WebviewGpuPolicyOnDemand,
}

func ConfigureGraphicsEnvironment() GraphicsRuntimeState {
	graphicsRuntimeState = GraphicsRuntimeState{
		ConfiguredMode: config.GetLinuxGraphicsMode(),
		EffectiveMode:  config.LinuxGraphicsModeNative,
		GpuPolicy:      application.WebviewGpuPolicyOnDemand,
	}

	if runtime.GOOS != "linux" {
		return graphicsRuntimeState
	}

	previousStartupIncomplete := hasStaleStartupMarker()
	createStartupMarker()

	isNVWayland := isNVIDIA() && isWayland()
	effectiveMode := resolveEffectiveMode(
		graphicsRuntimeState.ConfiguredMode,
		isNVWayland,
		previousStartupIncomplete,
	)
	graphicsRuntimeState.EffectiveMode = effectiveMode

	switch effectiveMode {
	case config.LinuxGraphicsModeSoftware:
		logger.Info("Graphics mode: software (explicit)")
		configureNVIDIAWaylandFix()
		os.Setenv("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
		os.Setenv("GSK_RENDERER", "cairo")
		graphicsRuntimeState.GpuPolicy = application.WebviewGpuPolicyNever
	case config.LinuxGraphicsModeCompat:
		logger.Info("Graphics mode: compat")
		configureNVIDIAWaylandFix()
		if isHyprland() && isNVIDIA() {
			configureHyprlandNVIDIAFix()
		}
		graphicsRuntimeState.GpuPolicy = application.WebviewGpuPolicyOnDemand
	default:
		logger.Info("Graphics mode: native")
		if isNVWayland {
			// Keep DMABUF safety net on NVIDIA + Wayland.
			os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
			os.Setenv("GBM_BACKEND", "nvidia-drm")
		}
		graphicsRuntimeState.GpuPolicy = application.WebviewGpuPolicyOnDemand
	}

	logger.Infof(
		"graphics configured_mode=%s effective_mode=%s fallback_active=%v fallback_reason=%s gpu_policy=%v",
		graphicsRuntimeState.ConfiguredMode,
		graphicsRuntimeState.EffectiveMode,
		graphicsRuntimeState.FallbackActive,
		graphicsRuntimeState.FallbackReason,
		graphicsRuntimeState.GpuPolicy,
	)

	return graphicsRuntimeState
}

func GetGraphicsRuntimeState() GraphicsRuntimeState {
	return graphicsRuntimeState
}

func MarkGraphicsStartupSuccessful() {
	if runtime.GOOS != "linux" {
		return
	}
	clearStartupMarker()
	if graphicsRuntimeState.EffectiveMode == config.LinuxGraphicsModeNative {
		clearAutoFallbackFlag()
	}
}

func resolveEffectiveMode(configuredMode string, isNVWayland bool, previousStartupIncomplete bool) string {
	switch configuredMode {
	case config.LinuxGraphicsModeSoftware, config.LinuxGraphicsModeCompat, config.LinuxGraphicsModeNative:
		return configuredMode
	}

	// Auto mode: native-first with startup-failure-based fallback.
	if !isNVWayland {
		return config.LinuxGraphicsModeNative
	}
	if hasAutoFallbackFlag() {
		graphicsRuntimeState.FallbackActive = true
		graphicsRuntimeState.FallbackReason = "auto_fallback_flag"
		return config.LinuxGraphicsModeCompat
	}
	if previousStartupIncomplete {
		graphicsRuntimeState.FallbackActive = true
		graphicsRuntimeState.FallbackReason = "previous_startup_incomplete"
		setAutoFallbackFlag()
		return config.LinuxGraphicsModeCompat
	}

	return config.LinuxGraphicsModeNative
}

func isNVIDIA() bool {
	if output, err := exec.Command("lspci", "-nn").Output(); err == nil {
		return strings.Contains(strings.ToLower(string(output)), "nvidia")
	}
	return os.Getenv("__NV_PRIME_RENDER_OFFLOAD") != ""
}

func isWayland() bool {
	return os.Getenv("XDG_SESSION_TYPE") == "wayland" ||
		os.Getenv("WAYLAND_DISPLAY") != ""
}

func isHyprland() bool {
	return os.Getenv("HYPRLAND_INSTANCE_SIGNATURE") != ""
}

func configureNVIDIAWaylandFix() {
	os.Setenv("GDK_BACKEND", "x11")

	os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
	os.Setenv("GBM_BACKEND", "nvidia-drm")
}

func configureHyprlandNVIDIAFix() {
	configureNVIDIAWaylandFix()

	os.Setenv("WLR_NO_HARDWARE_CURSORS", "1")
	os.Setenv("WLR_RENDERER_ALLOW_SOFTWARE", "1")
}

func startupMarkerPath() string {
	return filepath.Join(config.GetDataDirectory(), "graphics-startup.marker")
}

func autoFallbackFlagPath() string {
	return filepath.Join(config.GetDataDirectory(), "graphics-auto-fallback.flag")
}

func createStartupMarker() {
	_ = os.MkdirAll(config.GetDataDirectory(), 0o755)
	_ = os.WriteFile(startupMarkerPath(), []byte("pending"), 0o644)
}

func clearStartupMarker() {
	_ = os.Remove(startupMarkerPath())
}

func hasStaleStartupMarker() bool {
	_, err := os.Stat(startupMarkerPath())
	return err == nil
}

func setAutoFallbackFlag() {
	_ = os.MkdirAll(config.GetDataDirectory(), 0o755)
	_ = os.WriteFile(autoFallbackFlagPath(), []byte("compat"), 0o644)
}

func clearAutoFallbackFlag() {
	_ = os.Remove(autoFallbackFlagPath())
}

func hasAutoFallbackFlag() bool {
	_, err := os.Stat(autoFallbackFlagPath())
	return err == nil
}
