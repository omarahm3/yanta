/**
 * Hotkey combo parsing and matching.
 * Used by HotkeyContext for capture-phase and special-key handling.
 */

export const SPECIAL_KEY_SET = new Set(["?", ":", "shift+;", "shift+/"]);

const NON_TEXT_INPUT_TYPES = new Set(["checkbox", "radio", "button", "submit", "image", "reset"]);

export interface TargetClassification {
	/** Editable target: text <input>, <textarea>, or contenteditable. */
	inInputField: boolean;
	/** Non-editable interactive target: button/link, non-text input, role=button/link/checkbox/radio. */
	isInteractiveElement: boolean;
}

/**
 * Classifies an event target so the dispatcher can decide whether a hotkey
 * should be allowed to fire on it. Editable fields must keep receiving typed
 * characters; buttons/links must keep their native Enter/Space activation.
 *
 * Editability is resolved through the contenteditable ancestor chain because a
 * rich-text editor (BlockNote/ProseMirror) fires keydown on a nested node, not
 * the contenteditable root. Non-text inputs (checkbox/radio/submit/...) are
 * treated as interactive controls, not text fields, so modifier hotkeys still
 * reach them.
 */
export function classifyEventTarget(target: EventTarget | null): TargetClassification {
	const el = target as HTMLElement | null;
	const tag = el?.tagName;
	const role = el?.getAttribute?.("role");
	const inputType = el?.getAttribute?.("type")?.toLowerCase();

	const isNonTextInput = tag === "INPUT" && NON_TEXT_INPUT_TYPES.has(inputType ?? "");

	// isContentEditable is correct in real browsers (handles inheritance); the
	// closest() fallback covers nested targets under jsdom, which does not
	// implement isContentEditable.
	const isEditable =
		el?.isContentEditable === true || Boolean(el?.closest?.('[contenteditable="true"]'));

	const inInputField = (tag === "INPUT" && !isNonTextInput) || tag === "TEXTAREA" || isEditable;

	const isInteractiveElement =
		tag === "BUTTON" ||
		tag === "A" ||
		isNonTextInput ||
		role === "button" ||
		role === "link" ||
		role === "checkbox" ||
		role === "radio";

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
 *
 * Escape is exempt from the interactive-element guard: it has no native action
 * on a button/link, and blocking it would trap the user in an overlay they
 * cannot dismiss with the keyboard while a control inside it is focused.
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
	if (isInteractiveElement && !hasModifier && event.key !== "Escape") {
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
