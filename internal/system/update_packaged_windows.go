//go:build windows

package system

import (
	"syscall"
	"unsafe"
)

// errorInsufficientBuffer is the Win32 error ERROR_INSUFFICIENT_BUFFER (122).
// Called with a null buffer, GetCurrentPackageFullName returns this ONLY for a
// process that has MSIX package identity (the required name did not fit). An
// unpackaged desktop process instead returns APPMODEL_ERROR_NO_PACKAGE (15700).
// Treating ERROR_INSUFFICIENT_BUFFER as the sole "packaged" signal — and every
// other return (including unexpected errors) as "not packaged" — is the
// documented detection pattern and ensures an API failure can never wrongly
// silence updates for a normal NSIS/portable install.
const errorInsufficientBuffer = 122

var (
	modkernel32                   = syscall.NewLazyDLL("kernel32.dll")
	procGetCurrentPackageFullName = modkernel32.NewProc("GetCurrentPackageFullName")
)

// isStorePackaged reports whether the running process has MSIX package identity,
// which is true only when YANTA was installed from the Microsoft Store package.
// The Store owns updates for such installs (policy 10.2.5), so the in-app update
// check is disabled for them.
func isStorePackaged() bool {
	// GetCurrentPackageFullName exists on Windows 8+, always satisfied by YANTA's
	// WebView2-capable Windows 10+ floor. Guard anyway so a missing export
	// degrades to "not packaged" rather than panicking in LazyProc.Call.
	if err := procGetCurrentPackageFullName.Find(); err != nil {
		return false
	}
	var length uint32
	// Call returns a Win32 LONG; mask to uint32 before comparing since the upper
	// bits of the amd64 return register are not guaranteed to be cleared.
	ret, _, _ := procGetCurrentPackageFullName.Call(uintptr(unsafe.Pointer(&length)), 0)
	return uint32(ret) == errorInsufficientBuffer
}
