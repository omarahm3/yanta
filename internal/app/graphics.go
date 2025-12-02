package app

import (
	"os"
	"os/exec"
	"runtime"
	"strings"

	"yanta/internal/logger"
)

func ConfigureGraphicsEnvironment() {
	if runtime.GOOS != "linux" {
		return
	}

	if isNVIDIA() && isWayland() {
		logger.Info("Detected NVIDIA + Wayland - applying compatibility fixes")
		configureNVIDIAWaylandFix()
		return
	}

	if isHyprland() && isNVIDIA() {
		logger.Info("Detected Hyprland + NVIDIA - applying extra fixes")
		configureHyprlandNVIDIAFix()
		return
	}

	logger.Info("Using system default graphics configuration")
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

	os.Setenv("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
	os.Setenv("GSK_RENDERER", "cairo")
}

func configureHyprlandNVIDIAFix() {
	configureNVIDIAWaylandFix()

	os.Setenv("WLR_NO_HARDWARE_CURSORS", "1")
	os.Setenv("WLR_RENDERER_ALLOW_SOFTWARE", "1")
}
