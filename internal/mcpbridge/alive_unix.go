//go:build !windows

package mcpbridge

import (
	"os"
	"syscall"
)

// processAlive reports whether a process with the given PID is currently
// running. On Unix, os.FindProcess always succeeds, so we probe with signal 0
// (the null signal): the kernel runs its permission and existence checks
// without delivering anything.
//
// The result only refines an error message after a failed connection, so a
// false positive (e.g. PID reused by an unrelated process) is harmless — it
// simply falls through to the generic "cannot reach Yanta" message.
func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	p, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return p.Signal(syscall.Signal(0)) == nil
}
