import { describe, expect, it } from "vitest";
import type { Shortcut } from "../../shared/ui";
import { filterShortcutsByQuery, groupShortcutsByCategory } from "../ShortcutsSection";

describe("Shortcuts table grouping and search (MRG-362)", () => {
	const shortcuts: Shortcut[] = [
		{ id: "global.help", action: "Toggle help", defaultKey: "shift+/", currentKey: "shift+/" },
		{
			id: "global.commandPalette",
			action: "Open command palette",
			defaultKey: "mod+K",
			currentKey: "mod+K",
		},
		{ id: "sidebar.toggle", action: "Toggle sidebar", defaultKey: "ctrl+B", currentKey: "ctrl+B" },
		{ id: "document.save", action: "Save document", defaultKey: "mod+S", currentKey: "mod+S" },
		{
			id: "dashboard.newDocument",
			action: "Create new document",
			defaultKey: "mod+N",
			currentKey: "mod+N",
		},
	];

	describe("groupShortcutsByCategory", () => {
		it("groups shortcuts by their prefix", () => {
			const groups = groupShortcutsByCategory(shortcuts);
			expect(groups).toHaveProperty("global");
			expect(groups).toHaveProperty("sidebar");
			expect(groups).toHaveProperty("document");
			expect(groups).toHaveProperty("dashboard");
		});

		it("returns correct shortcuts per group", () => {
			const groups = groupShortcutsByCategory(shortcuts);
			expect(groups.global).toHaveLength(2);
			expect(groups.sidebar).toHaveLength(1);
			expect(groups.document).toHaveLength(1);
			expect(groups.dashboard).toHaveLength(1);
		});

		it("handles empty shortcut list", () => {
			const groups = groupShortcutsByCategory([]);
			expect(Object.keys(groups)).toHaveLength(0);
		});
	});

	describe("filterShortcutsByQuery", () => {
		it("filters by action name", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "help");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("global.help");
		});

		it("filters by key", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "mod+K");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("global.commandPalette");
		});

		it("is case-insensitive", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "SAVE");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("document.save");
		});

		it("returns all shortcuts when query is empty", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "");
			expect(filtered).toHaveLength(shortcuts.length);
		});

		it("returns empty array when no matches", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "xyz123");
			expect(filtered).toHaveLength(0);
		});

		it("matches partial action names", () => {
			const filtered = filterShortcutsByQuery(shortcuts, "command");
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("global.commandPalette");
		});
	});
});
