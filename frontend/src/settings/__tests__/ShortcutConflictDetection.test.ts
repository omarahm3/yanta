import { describe, expect, it } from "vitest";
import { detectShortcutConflict, type ShortcutEntry } from "../ShortcutsSection";

describe("Shortcut conflict detection (MRG-361)", () => {
	const shortcuts: ShortcutEntry[] = [
		{ id: "global.help", action: "Toggle help", defaultKey: "shift+/", currentKey: "shift+/" },
		{
			id: "global.commandPalette",
			action: "Open command palette",
			defaultKey: "mod+K",
			currentKey: "mod+K",
		},
		{ id: "global.today", action: "Jump to today", defaultKey: "mod+T", currentKey: "mod+T" },
		{ id: "sidebar.toggle", action: "Toggle sidebar", defaultKey: "ctrl+B", currentKey: "ctrl+B" },
	];

	it("returns null when no conflict exists", () => {
		const conflict = detectShortcutConflict("global.help", "shift+/", shortcuts);
		expect(conflict).toBeNull();
	});

	it("detects conflict when key is already used by another action", () => {
		const conflict = detectShortcutConflict("global.help", "mod+K", shortcuts);
		expect(conflict).not.toBeNull();
		expect(conflict!.id).toBe("global.commandPalette");
		expect(conflict!.action).toBe("Open command palette");
	});

	it("does not flag conflict with self", () => {
		const conflict = detectShortcutConflict("global.help", "shift+/", shortcuts);
		expect(conflict).toBeNull();
	});

	it("is case-insensitive", () => {
		const conflict = detectShortcutConflict("global.help", "MOD+k", shortcuts);
		expect(conflict).not.toBeNull();
		expect(conflict!.id).toBe("global.commandPalette");
	});

	it("handles empty shortcut list", () => {
		const conflict = detectShortcutConflict("global.help", "mod+K", []);
		expect(conflict).toBeNull();
	});

	it("handles empty key", () => {
		const conflict = detectShortcutConflict("global.help", "", shortcuts);
		expect(conflict).toBeNull();
	});
});
