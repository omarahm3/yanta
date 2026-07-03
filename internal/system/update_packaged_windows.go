//go:build windows

package system

import (
	"syscall"
	"unsafe"
)

// appModelErrorNoPackage is the Win32 error APPMODEL_ERROR_NO_PACKAGE (15700),
// returned by GetCurrentPackageFullName when the process has no MSIX package
// identity — i.e. it is a plain Win32 build (NSIS installer or portable exe)
// rather than an installed Microsoft Store package.
const appModelErrorNoPackage = 15700

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
	// With a nil buffer and length 0 the call returns ERROR_INSUFFICIENT_BUFFER
	// when packaged (and fills in the required length) or APPMODEL_ERROR_NO_PACKAGE
	// when not. We only need to distinguish those two outcomes.
	var length uint32
	ret, _, _ := procGetCurrentPackageFullName.Call(uintptr(unsafe.Pointer(&length)), 0)
	return ret != appModelErrorNoPackage
}
