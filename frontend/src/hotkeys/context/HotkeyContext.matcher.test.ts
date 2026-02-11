import { describe, expect, it } from "vitest";
import { createHotkeyMatcher } from "../utils/hotkeyMatcher";

const trigger = (matcher: (e: KeyboardEvent) => boolean, init: KeyboardEventInit) =>
	matcher(new KeyboardEvent("keydown", init));

describe("createHotkeyMatcher", () => {
	it("matches simple key without modifiers", () => {
		const m = createHotkeyMatcher("k");
		expect(trigger(m, { key: "k" })).toBe(true);
		expect(trigger(m, { key: "K" })).toBe(true);
		expect(trigger(m, { key: "x" })).toBe(false);
	});

	it("matches ctrl+key combinations", () => {
		const m = createHotkeyMatcher("ctrl+k");
		expect(trigger(m, { key: "k", ctrlKey: true })).toBe(true);
		expect(trigger(m, { key: "k", ctrlKey: false })).toBe(false);
		expect(trigger(m, { key: "k", ctrlKey: true, shiftKey: true })).toBe(false);
	});

	it("treats mod as ctrl on non-mac platforms", () => {
		// In this test environment, navigator is either undefined or non-Mac, so mod → ctrl
		const m = createHotkeyMatcher("mod+k");
		expect(trigger(m, { key: "k", ctrlKey: true, metaKey: false })).toBe(true);
		expect(trigger(m, { key: "k", ctrlKey: false, metaKey: true })).toBe(false);
	});

	it("treats mod as meta on mac platforms", () => {
		const originalNavigator = (globalThis as { navigator?: { platform?: string } }).navigator;
		Object.defineProperty(globalThis, "navigator", {
			value: { platform: "MacIntel" },
			configurable: true,
		});

		const m = createHotkeyMatcher("mod+k");
		expect(trigger(m, { key: "k", metaKey: true, ctrlKey: false })).toBe(true);
		expect(trigger(m, { key: "k", metaKey: false, ctrlKey: true })).toBe(false);

		if (originalNavigator) {
			Object.defineProperty(globalThis, "navigator", {
				value: originalNavigator,
				configurable: true,
			});
		} else {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete (globalThis as { navigator?: unknown }).navigator;
		}
	});

	it("handles shift-modified backslash (\\ vs |) correctly", () => {
		const m = createHotkeyMatcher("shift+\\");
		// When typing '|' the event key is often '|' with shift pressed
		expect(trigger(m, { key: "|", shiftKey: true })).toBe(true);
		expect(trigger(m, { key: "\\", shiftKey: true })).toBe(false);
		expect(trigger(m, { key: "|", shiftKey: false })).toBe(false);
	});

	it("matches Space key (event.key is ' ', config uses 'Space')", () => {
		const m = createHotkeyMatcher("Space");
		expect(trigger(m, { key: " " })).toBe(true);
		expect(trigger(m, { key: "a" })).toBe(false);
	});
});
