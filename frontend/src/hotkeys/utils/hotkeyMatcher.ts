/**
 * Hotkey combo parsing and matching.
 * Used by HotkeyContext for capture-phase and special-key handling.
 */

export const SPECIAL_KEY_SET = new Set(["?", ":", "shift+;", "shift+/"]);

export const isMacPlatform = (): boolean =>
	typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Creates a matcher function for a hotkey combo string (e.g. "mod+k", "ctrl+shift+s").
 * "mod" resolves to Meta on Mac, Ctrl on Windows/Linux.
 */
export function createHotkeyMatcher(combo: string): (event: KeyboardEvent) => boolean {
	const parts = combo
		.split("+")
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);

	let requireKey: string | null = null;
	let requireCtrl = false;
	let requireMeta = false;
	let requireAlt = false;
	let requireShift = false;

	parts.forEach((part) => {
		switch (part) {
			case "mod":
				if (isMacPlatform()) {
					requireMeta = true;
				} else {
					requireCtrl = true;
				}
				break;
			case "ctrl":
			case "control":
				requireCtrl = true;
				break;
			case "cmd":
			case "command":
			case "meta":
				requireMeta = true;
				break;
			case "alt":
			case "option":
				requireAlt = true;
				break;
			case "shift":
				requireShift = true;
				break;
			default:
				requireKey = part;
				break;
		}
	});

	return (event: KeyboardEvent) => {
		const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();

		if (requireKey) {
			// shift+backslash: only match when key is "|" (shifted), not literal "\\"
			const keyMatches = requireKey === "\\" && requireShift ? key === "|" : key === requireKey;
			if (!keyMatches) {
				return false;
			}
		}

		if (event.ctrlKey !== requireCtrl) return false;
		if (event.metaKey !== requireMeta) return false;
		if (event.altKey !== requireAlt) return false;
		if (event.shiftKey !== requireShift) return false;

		return true;
	};
}
