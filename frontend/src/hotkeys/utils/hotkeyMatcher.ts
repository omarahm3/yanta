/**
 * Hotkey combo parsing and matching.
 * Used by HotkeyContext for capture-phase and special-key handling.
 */

export const SPECIAL_KEY_SET = new Set(["?", ":", "shift+;", "shift+/"]);

export interface TargetClassification {
	/** Editable target: <input>, <textarea>, or contenteditable. */
	inInputField: boolean;
	/** Non-editable interactive target: <button>, <a>, role=button/link/checkbox. */
	isInteractiveElement: boolean;
}

/**
 * Classifies an event target so the dispatcher can decide whether a hotkey
 * should be allowed to fire on it. Editable fields must keep receiving typed
 * characters; buttons/links must keep their native Enter/Space activation.
 */
export function classifyEventTarget(target: EventTarget | null): TargetClassification {
	const el = target as HTMLElement | null;
	const tag = el?.tagName;
	const role = el?.getAttribute?.("role");

	const inInputField =
		tag === "INPUT" || tag === "TEXTAREA" || el?.getAttribute?.("contenteditable") === "true";

	const isInteractiveElement =
		tag === "BUTTON" || tag === "A" || role === "button" || role === "link" || role === "checkbox";

	return {
		inInputField: Boolean(inInputField),
		isInteractiveElement: Boolean(isInteractiveElement),
	};
}

/**
 * Decides whether a hotkey may fire for the given keyboard event and target.
 *
 * A handler that opts in with `allowInInput` always fires. Otherwise the key is
 * skipped when the target is an editable field (any key would otherwise be
 * swallowed) or when the target is a button/link/role=button and the key has no
 * Ctrl/Cmd/Alt modifier (plain keys like Enter/Space/j/k would otherwise hijack
 * the element's native behavior). Modifier combos still reach focused buttons.
 */
export function isHotkeyEligibleForTarget(
	event: KeyboardEvent,
	target: EventTarget | null,
	allowInInput: boolean | undefined,
): boolean {
	if (allowInInput) {
		return true;
	}

	const { inInputField, isInteractiveElement } = classifyEventTarget(target);
	if (inInputField) {
		return false;
	}

	const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
	if (isInteractiveElement && !hasModifier) {
		return false;
	}

	return true;
}

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

	// event.key for spacebar is " "; config uses "Space" -> "space" after toLowerCase
	if (requireKey === "space") requireKey = " ";

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
