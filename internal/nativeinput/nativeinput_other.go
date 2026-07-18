//go:build !linux || !cgo || gtk3

package nativeinput

import "unsafe"

// AttachCtrlVCapture is a no-op outside Linux/GTK4 builds: other platforms'
// webviews deliver real paste events the frontend handles natively.
func AttachCtrlVCapture(_ unsafe.Pointer, _ func()) {}
