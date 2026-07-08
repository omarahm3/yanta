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

	it("detects nested targets inside a contenteditable container", () => {
		// A rich-text editor (BlockNote/ProseMirror) fires keydown on a nested
		// node, not the contenteditable root itself.
		const editor = el("div", { contenteditable: "true" });
		const paragraph = el("p");
		const span = el("span");
		paragraph.appendChild(span);
		editor.appendChild(paragraph);
		document.body.appendChild(editor);

		expect(classifyEventTarget(span).inInputField).toBe(true);
		expect(classifyEventTarget(paragraph).inInputField).toBe(true);
	});

	it("detects interactive non-editable elements", () => {
		expect(classifyEventTarget(el("button")).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("a")).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div", { role: "button" })).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div", { role: "checkbox" })).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div", { role: "radio" })).isInteractiveElement).toBe(true);
		expect(classifyEventTarget(el("div")).isInteractiveElement).toBe(false);
	});

	it("classifies non-text inputs as interactive, not editable", () => {
		for (const type of ["checkbox", "radio", "button", "submit", "image", "reset"]) {
			const node = el("input", { type });
			expect(classifyEventTarget(node).inInputField).toBe(false);
			expect(classifyEventTarget(node).isInteractiveElement).toBe(true);
		}
		// Text-like inputs remain editable fields.
		expect(classifyEventTarget(el("input", { type: "text" })).inInputField).toBe(true);
		expect(classifyEventTarget(el("input", { type: "search" })).inInputField).toBe(true);
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

	it("never blocks Escape on interactive elements (no keyboard trap)", () => {
		const button = el("button");
		expect(isHotkeyEligibleForTarget(keydown({ key: "Escape" }), button, false)).toBe(true);
		expect(isHotkeyEligibleForTarget(keydown({ key: "Escape" }), el("a"), false)).toBe(true);
		// Escape is still blocked in editable fields (handled via allowInInput there).
		expect(isHotkeyEligibleForTarget(keydown({ key: "Escape" }), el("input"), false)).toBe(false);
	});
});
