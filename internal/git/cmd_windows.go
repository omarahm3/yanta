//go:build windows

package git

import (
	"os/exec"
	"syscall"
	"time"
)

func hideConsoleWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}

// setGracefulCancel bounds how long we wait after cancelling a git process
// before force-killing it, so a stuck operation can't hang the caller. Windows
// lacks a clean SIGTERM equivalent, so we rely on the default kill but cap the
// I/O drain via WaitDelay.
func setGracefulCancel(cmd *exec.Cmd) {
	cmd.WaitDelay = 5 * time.Second
}
