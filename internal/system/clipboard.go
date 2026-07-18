package system

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// clipboardImageMIMEs are the image types we try to pull from the clipboard,
// most-preferred first.
var clipboardImageMIMEs = []string{"image/png", "image/jpeg", "image/webp", "image/gif"}

// ReadClipboardImage returns the current clipboard image as a data URL
// (data:<mime>;base64,<data>), or an empty string when the clipboard holds no
// image. The WebKitGTK webview denies the browser Clipboard API and never fires
// paste events on the (non-editable) canvas, so image paste reads the system
// clipboard natively here instead.
func (s *Service) ReadClipboardImage(ctx context.Context) (string, error) {
	if runtime.GOOS != "linux" {
		return "", fmt.Errorf("clipboard image read is only supported on linux, not %s", runtime.GOOS)
	}

	tool, argsFor := clipboardReader()
	if tool == "" {
		return "", fmt.Errorf("no clipboard tool found; install wl-clipboard (Wayland) or xclip (X11)")
	}

	for _, mime := range clipboardImageMIMEs {
		out, err := exec.CommandContext(ctx, tool, argsFor(mime)...).Output()
		if err != nil {
			// The tool exits non-zero when the requested type isn't on the
			// clipboard — expected while probing, so move on to the next type.
			continue
		}
		if len(out) == 0 {
			continue
		}
		return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(out)), nil
	}

	return "", nil
}

// clipboardReader picks the clipboard CLI to shell out to and returns a builder
// for its per-MIME read arguments. Prefers wl-paste under Wayland, otherwise
// xclip, falling back to whichever is installed.
func clipboardReader() (string, func(mime string) []string) {
	wlPaste := commandExists("wl-paste")
	xclip := commandExists("xclip")
	wayland := os.Getenv("WAYLAND_DISPLAY") != ""

	wlArgs := func(mime string) []string { return []string{"--no-newline", "--type", mime} }
	xclipArgs := func(mime string) []string { return []string{"-selection", "clipboard", "-t", mime, "-o"} }

	if wayland && wlPaste {
		return "wl-paste", wlArgs
	}
	if xclip {
		return "xclip", xclipArgs
	}
	if wlPaste {
		return "wl-paste", wlArgs
	}
	return "", nil
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
