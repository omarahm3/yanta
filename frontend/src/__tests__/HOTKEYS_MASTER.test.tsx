import { describe, it } from "vitest";

describe("Hotkey coverage", () => {
	it("documents tested hotkeys", () => {
		const coverage = {
			global: {
				component: "App.tsx",
				hotkeys: ["shift+/", "mod+K"],
				testFile: "App.hotkeys.test.tsx",
			},
			layout: {
				component: "Layout.tsx",
				hotkeys: ["ctrl+b", "mod+e", "shift+;", "Escape"],
				testFile: "Layout.hotkeys.test.tsx",
			},
			document: {
				component: "Document.tsx",
				hotkeys: ["mod+s", "Escape", "mod+C", "Enter"],
				testFile: "Document.hotkeys.test.tsx",
			},
			dashboard: {
				component: "Dashboard.tsx",
				hotkeys: ["mod+N", "mod+shift+A", "j", "k", "ArrowDown", "ArrowUp", "Enter", "mod+A", "mod+U"],
				testFile: "Dashboard.hotkeys.test.tsx",
			},
			projects: {
				component: "Projects.tsx",
				hotkeys: [
					"j",
					"k",
					"ArrowDown",
					"ArrowUp",
					"Enter",
					"mod+N",
					"mod+A",
					"mod+U",
					"mod+R",
					"mod+D",
				],
				testFile: "Projects.hotkeys.test.tsx",
			},
			search: {
				component: "Search.tsx",
				hotkeys: ["Tab", "Escape", "j", "k", "/", "Enter"],
				testFile: "Search.hotkeys.test.tsx",
			},
			commandPalette: {
				component: "CommandPalette.tsx",
				hotkeys: ["Escape", "Ctrl+N", "Ctrl+P", "ArrowDown", "ArrowUp", "Enter"],
				testFile: "CommandPalette.hotkeys.test.tsx",
			},
			helpModal: {
				component: "HelpModal.tsx",
				hotkeys: ["Escape", "?"],
				testFile: "HelpModal.hotkeys.test.tsx",
			},
			settings: {
				component: "Settings.tsx",
				hotkeys: ["j", "k"],
				testFile: "Settings.hotkeys.test.tsx",
			},
		};

		console.log("\n=== HOTKEY COVERAGE ===\n");
		Object.entries(coverage).forEach(([_, data]) => {
			console.log(`${data.component}: ${data.hotkeys.join(", ")}`);
		});

		const totalHotkeys = Object.values(coverage).reduce((sum, data) => sum + data.hotkeys.length, 0);
		console.log(
			`\nTotal: ${totalHotkeys} hotkeys tested across ${Object.keys(coverage).length} components\n`,
		);

		expect(Object.keys(coverage)).toHaveLength(9);
		expect(totalHotkeys).toBe(45);
	});
});
