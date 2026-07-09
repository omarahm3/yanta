package app

import (
	"strings"
	"testing"
)

func TestBackgroundRecoveryMessage(t *testing.T) {
	t.Run("windows advertises the restore hotkey and the tray", func(t *testing.T) {
		msg := backgroundRecoveryMessage("windows")
		if !strings.Contains(msg, "Ctrl+Shift+Y") {
			t.Errorf("windows message should mention the restore hotkey, got: %q", msg)
		}
		if !strings.Contains(msg, "system tray") {
			t.Errorf("windows message should mention the system tray, got: %q", msg)
		}
	})

	for _, goos := range []string{"darwin", "linux"} {
		t.Run(goos+" mentions the tray but not the Windows-only hotkey", func(t *testing.T) {
			msg := backgroundRecoveryMessage(goos)
			if strings.Contains(msg, "Ctrl+Shift+Y") {
				t.Errorf("%s message must not advertise the Windows-only hotkey, got: %q", goos, msg)
			}
			if !strings.Contains(msg, "system tray") {
				t.Errorf("%s message should mention the system tray, got: %q", goos, msg)
			}
		})
	}
}
