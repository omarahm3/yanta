package system

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

var preferredImageMIMEs = []string{"image/png", "image/jpeg", "image/webp", "image/gif"}

// ReadClipboardImage returns the current clipboard image as a data URL
// (data:<mime>;base64,<data>), or an empty string when the clipboard holds no
// image. Linux/WebKitGTK only: that webview denies the browser Clipboard API
// and never fires paste events on the canvas. Windows/macOS webviews deliver
// real paste events that Excalidraw handles itself, so they never call this.
func (s *Service) ReadClipboardImage(ctx context.Context) (string, error) {
	if runtime.GOOS != "linux" {
		return "", fmt.Errorf("clipboard image read is only supported on linux, not %s", runtime.GOOS)
	}

	reader := clipboardReader()
	if reader == nil {
		return "", fmt.Errorf("no clipboard tool found; install wl-clipboard (Wayland) or xclip (X11)")
	}

	// Read the types the clipboard actually offers rather than blind-probing a
	// fixed list; fall back to the preferred list if the listing fails.
	mimes := pickImageMIMEs(listClipboardTypes(ctx, reader))
	if len(mimes) == 0 {
		mimes = preferredImageMIMEs
	}

	for _, mime := range mimes {
		out, err := exec.CommandContext(ctx, reader.tool, reader.readArgs(mime)...).Output()
		if err != nil {
			continue // non-zero exit = type not on clipboard; try the next
		}
		if len(out) == 0 {
			continue
		}
		return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(out)), nil
	}

	return "", nil
}

type clipboardTool struct {
	tool     string
	listArgs []string
	readArgs func(mime string) []string
}

// clipboardReader picks the clipboard CLI to shell out to. Prefers wl-paste on
// Wayland (checking both WAYLAND_DISPLAY and XDG_SESSION_TYPE — portal launches
// sometimes strip one) because under a Wayland compositor xclip only sees the
// XWayland clipboard, which isn't reliably synced with the Wayland one.
func clipboardReader() *clipboardTool {
	wlPaste := commandExists("wl-paste")
	xclip := commandExists("xclip")
	wayland := os.Getenv("WAYLAND_DISPLAY") != "" ||
		strings.EqualFold(os.Getenv("XDG_SESSION_TYPE"), "wayland")

	wl := &clipboardTool{
		tool:     "wl-paste",
		listArgs: []string{"--list-types"},
		readArgs: func(mime string) []string { return []string{"--no-newline", "--type", mime} },
	}
	x := &clipboardTool{
		tool:     "xclip",
		listArgs: []string{"-selection", "clipboard", "-t", "TARGETS", "-o"},
		readArgs: func(mime string) []string { return []string{"-selection", "clipboard", "-t", mime, "-o"} },
	}

	switch {
	case wayland && wlPaste:
		return wl
	case xclip:
		return x
	case wlPaste:
		return wl
	}
	return nil
}

// listClipboardTypes returns the MIME types the clipboard currently offers,
// or nil when the listing fails (tool missing the flag, empty clipboard, ...).
func listClipboardTypes(ctx context.Context, reader *clipboardTool) []string {
	out, err := exec.CommandContext(ctx, reader.tool, reader.listArgs...).Output()
	if err != nil {
		return nil
	}
	var types []string
	for _, line := range strings.Split(string(out), "\n") {
		if t := strings.TrimSpace(line); t != "" {
			types = append(types, t)
		}
	}
	return types
}

// pickImageMIMEs filters offered clipboard types to image types, preferred
// first, then any remaining image/* so a clipboard offering only a nonstandard
// type (e.g. "image/jpg", "image/bmp") still reads.
func pickImageMIMEs(offered []string) []string {
	offeredSet := make(map[string]bool, len(offered))
	for _, t := range offered {
		offeredSet[t] = true
	}

	var mimes []string
	seen := make(map[string]bool)
	for _, preferred := range preferredImageMIMEs {
		if offeredSet[preferred] {
			mimes = append(mimes, preferred)
			seen[preferred] = true
		}
	}
	for _, t := range offered {
		if strings.HasPrefix(t, "image/") && !seen[t] {
			mimes = append(mimes, t)
			seen[t] = true
		}
	}
	return mimes
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
