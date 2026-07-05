//go:build !windows

package git

import (
	"os/exec"
	"syscall"
	"time"
)

// hideConsoleWindow is a no-op on Unix systems
func hideConsoleWindow(cmd *exec.Cmd) {
}

// setGracefulCancel makes context cancellation send SIGTERM (which git traps to
// clean up lockfiles) instead of the default immediate SIGKILL, and bounds the
// grace period before a force-kill so a wedged process can't hang the caller.
func setGracefulCancel(cmd *exec.Cmd) {
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return cmd.Process.Signal(syscall.SIGTERM)
	}
	cmd.WaitDelay = 5 * time.Second
}
