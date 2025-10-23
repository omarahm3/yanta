#!/bin/bash
# Yanta launcher script with proper Wayland support
# This script ensures correct GDK backend selection based on the session type

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Try different locations for the binary
if [ -f "${SCRIPT_DIR}/build/bin/yanta" ]; then
    YANTA_BIN="${SCRIPT_DIR}/build/bin/yanta"
elif [ -f "${SCRIPT_DIR}/yanta" ]; then
    YANTA_BIN="${SCRIPT_DIR}/yanta"
elif command -v yanta >/dev/null 2>&1; then
    YANTA_BIN="yanta"
else
    echo "ERROR: Cannot find yanta binary!" >&2
    echo "Tried:" >&2
    echo "  - ${SCRIPT_DIR}/build/bin/yanta" >&2
    echo "  - ${SCRIPT_DIR}/yanta" >&2
    echo "  - yanta (in PATH)" >&2
    exit 1
fi

echo "Using binary: $YANTA_BIN" >&2

# Only set GDK_BACKEND to x11 if:
# 1. GDK_BACKEND is not already set AND
# 2. XDG_SESSION_TYPE is not "wayland"
#
# This allows Wayland sessions to run natively while ensuring X11 compatibility
if [ -z "$GDK_BACKEND" ]; then
    case "${XDG_SESSION_TYPE:-unspecified}" in
        wayland|mir|tty)
            # Leave GDK_BACKEND unset for Wayland, Mir, or TTY sessions
            # GTK will automatically use the correct backend
            ;;
        x11|unspecified|"")
            # For X11 sessions or when session type is unknown, explicitly use X11 backend
            # This ensures window positioning and other X11-specific features work correctly
            export GDK_BACKEND=x11
            ;;
        *)
            # For any other session type, let GTK auto-detect
            ;;
    esac
fi

# Enable WebKit2GTK Wayland support if in a Wayland session
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    # Allow Wayland socket access
    if [ -n "$WAYLAND_DISPLAY" ]; then
        export GDK_BACKEND=wayland
    fi

    # NVIDIA Wayland workaround: Use software rendering if NVIDIA GPU detected
    # This fixes crashes on shutdown with proprietary NVIDIA drivers
    if lspci 2>/dev/null | grep -qi nvidia || [ -n "$__NV_PRIME_RENDER_OFFLOAD" ]; then
        echo "NVIDIA GPU detected on Wayland - using software rendering for stability" >&2
        export WEBKIT_DISABLE_COMPOSITING_MODE=1
        export LIBGL_ALWAYS_SOFTWARE=1
        # Prevent GBM/DRM errors
        export GBM_BACKEND=
    else
        # Non-NVIDIA: Enable hardware acceleration
        export WEBKIT_DISABLE_COMPOSITING_MODE=0
    fi
fi

# Launch Yanta
exec "$YANTA_BIN" "$@"
