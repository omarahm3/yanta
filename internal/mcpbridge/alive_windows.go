//go:build windows

package mcpbridge

import "os"

// processAlive reports whether a process with the given PID is currently
// running. On Windows, os.FindProcess opens the process handle and returns an
// error once the process is gone, so a nil error means it is alive. We release
// the handle immediately since we only needed the liveness answer.
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
	_ = p.Release()
	return true
}
