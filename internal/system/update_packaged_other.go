//go:build !windows

package system

// isStorePackaged reports whether the running process is an MSIX/Microsoft Store
// package. Only Windows has MSIX packaging, so every other platform is always
// false and keeps the GitHub-based update notification.
func isStorePackaged() bool { return false }
