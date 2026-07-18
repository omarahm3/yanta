/**
 * Strips browser/dev-tooling affordances from production builds so the packaged
 * desktop app behaves identically on Windows, macOS, and Linux.
 *
 * Why at the DOM layer: Wails only honors DefaultContextMenuDisabled on Windows
 * in this version, and each platform's webview binds reload/devtools keys
 * differently (WebView2 and WebKitGTK reload on F5/Ctrl+R and expose an Inspect
 * entry; WKWebView differs again). Handling it here — the one hook every webview
 * honors — is what gives true cross-platform parity. The Go `production` build
 * tag still disables the native inspector on all three; this closes the
 * remaining gaps (native menu items and reload shortcuts).
 *
 * Dev builds are untouched: import.meta.env.PROD is false, so DevTools, reload,
 * and the native inspector all stay available while developing.
 */
export function installProductionLockdown(): void {
	if (!import.meta.env.PROD) return;
	if (typeof window === "undefined") return;

	// 1. Suppress the native right-click menu (Reload / Back / Forward / Inspect).
	//    - Skip when a component already opened its own menu (defaultPrevented),
	//      e.g. a Radix ContextMenu or Excalidraw's canvas menu.
	//    - Keep the native menu inside editable fields so right-click
	//      cut/copy/paste/spellcheck still works in notes and inputs.
	window.addEventListener(
		"contextmenu",
		(event) => {
			if (event.defaultPrevented) return;
			const target = event.target as Element | null;
			if (
				target?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
			) {
				return;
			}
			event.preventDefault();
		},
		false, // bubble phase: runs after component triggers, so their menus win
	);

	// 2. Block webview reload / devtools shortcuts. None of these are app hotkeys,
	//    so this can't shadow a real binding. Reload is destructive here (it
	//    discards in-memory editor state) and devtools must never open in a
	//    shipped build.
	window.addEventListener(
		"keydown",
		(event) => {
			const key = event.key;
			const mod = event.ctrlKey || event.metaKey; // Ctrl on Win/Linux, Cmd on macOS

			// Reload: F5, Ctrl/Cmd+R (Shift variant = hard reload, also covered).
			if (key === "F5" || (mod && (key === "r" || key === "R"))) {
				event.preventDefault();
				return;
			}
			// DevTools: F12 (redundant with the production tag, but keeps behaviour
			// identical across platforms regardless of webview defaults).
			if (key === "F12") {
				event.preventDefault();
			}
		},
		true, // capture phase: intercept before the webview acts on it
	);
}
