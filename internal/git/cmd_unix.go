//go:build !windows

package git

import (
	"os/exec"
)

// hideConsoleWindow is a no-op on Unix systems
func hideConsoleWindow(cmd *exec.Cmd) {
}
