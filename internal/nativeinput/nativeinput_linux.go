//go:build linux && cgo && !gtk3

// Package nativeinput hooks keyboard input at the GTK layer.
//
// WebKitGTK claims Ctrl+V in the GTK target phase and converts it into its
// internal (permission-blocked) Paste editing command, so the chord never
// reaches the DOM — no keydown, no paste event — and Wails' own key controller
// (attached in the default bubble phase) never sees it either. A capture-phase
// controller on the window runs BEFORE the webview can claim anything, which
// makes it the only reliable place to observe Ctrl+V on Linux.
package nativeinput

/*
#cgo linux pkg-config: gtk4

#include <gtk/gtk.h>

extern gboolean yantaKeyCapture(GtkEventControllerKey*, guint, guint, GdkModifierType, uintptr_t);

static void yanta_attach_key_capture(void *window) {
	GtkEventController *controller = gtk_event_controller_key_new();
	gtk_event_controller_set_propagation_phase(controller, GTK_PHASE_CAPTURE);
	gtk_widget_add_controller(GTK_WIDGET(window), controller);
	g_signal_connect(controller, "key-pressed", G_CALLBACK(yantaKeyCapture), NULL);
}
*/
import "C"

import "unsafe"

// GDK keyvals for lower/upper case v (see gdk/gdkkeysyms.h).
const (
	gdkKeyLowerV = 0x076
	gdkKeyUpperV = 0x056
)

var ctrlVCallback func()

//export yantaKeyCapture
func yantaKeyCapture(
	controller *C.GtkEventControllerKey,
	keyval C.guint,
	keycode C.guint,
	state C.GdkModifierType,
	data C.uintptr_t,
) C.gboolean {
	_ = controller
	_ = keycode
	_ = data
	if state&C.GDK_CONTROL_MASK != 0 &&
		state&C.GDK_ALT_MASK == 0 &&
		state&C.GDK_SHIFT_MASK == 0 &&
		(keyval == gdkKeyLowerV || keyval == gdkKeyUpperV) {
		if ctrlVCallback != nil {
			ctrlVCallback()
		}
	}
	// Never consume: typing and WebKit's own handling continue untouched (its
	// dead paste attempt on non-editable content is a no-op).
	return C.gboolean(0)
}

// AttachCtrlVCapture installs a capture-phase Ctrl+V observer on the given
// GtkWindow. Must be called on the GTK main thread (application.InvokeSync).
// Only one callback is supported; subsequent calls replace it.
func AttachCtrlVCapture(gtkWindow unsafe.Pointer, onCtrlV func()) {
	if gtkWindow == nil {
		return
	}
	ctrlVCallback = onCtrlV
	C.yanta_attach_key_capture(gtkWindow)
}
