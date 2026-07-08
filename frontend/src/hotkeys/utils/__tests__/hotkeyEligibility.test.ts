import { describe, expect, it } from "vitest";
import { classifyEventTarget, isHotkeyEligibleForTarget } from "../hotkeyMatcher";

const keydown = (init: KeyboardEventInit = {}) => new KeyboardEvent("keydown", init);

const el = (tag: string, attrs: Record<string, string> = {}) => {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		node.setAttribute(k, v);
	}
	return node;
};

describe("classifyEventTarget", () => {
	it("detects editable fields", () => {
		expect(classifyEventTarget(el("input")).inInputField).toBe(true);
		expect(classifyEventTarget(el("textarea")).inInputField).toBe(true);
		expect(classifyEventTarget(el("div", { contenteditable: "true" })).inInputField).toBe(true);
		expect(classifyEventTarget(el("div")).inInputField).toBe(false);
	});

	it("detects interactive non-editable elements", () => {
		expect(classifyEventTarget(el("button")).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("a")).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div", { role: "button" })).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div", { role: "checkbox" })).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div")).isInteractiveElement).toBe(false);
	});

	it("handles a null target", () => {
		expect(classifyEventTarget(null)).toEqual({
			inInputField: false,
			isInteractiveElement: false,
		});
	});
});

describe("isHotkeyEligibleForTarget", () => {
	it("allows plain keys on non-interactive targets", () => {
		expect(isHotkeyEligibleForTarget(keydown({ key: "j" }), el("div"), false)).toBe(true);
		expect(isHotkeyEligibleForTarget(keydown({ key: "j" }), null, false)).toBe(true);
	});

	it("blocks any key on editable fields unless allowInInput", () => {
		expect(isHotkeyEligibleForTarget(keydown({ key: "j" }), el("input"), false)).toBe(false);
		expect(isHotkeyEligibleForTarget(keydown({ key: "k", ctrlKey: true }), el("input"), false)).toBe(
			false,
		);
		expect(isHotkeyEligibleForTarget(keydown({ key: "j" }), el("input"), true)).toBe(true);
	});

	it("blocks plain keys on buttons/links but allows modifier combos", () => {
		const button = el("button");
		expect(isHotkeyEligibleForTarget(keydown({ key: "Enter" }), button, false)).toBe(false);
		expect(isHotkeyEligibleForTarget(keydown({ key: " " }), button, false)).toBe(false);
		expect(isHotkeyEligibleForTarget(keydown({ key: "j" }), button, false)).toBe(false);

		// Global modifier combos must still reach a focused button.
		expect(isHotkeyEligibleForTarget(keydown({ key: "k", ctrlKey: true }), button, false)).toBe(true);
		expect(isHotkeyEligibleForTarget(keydown({ key: "k", metaKey: true }), button, false)).toBe(true);

		// Explicit opt-in overrides the interactive guard.
		expect(isHotkeyEligibleForTarget(keydown({ key: "Enter" }), button, true)).toBe(true);
	});
});
