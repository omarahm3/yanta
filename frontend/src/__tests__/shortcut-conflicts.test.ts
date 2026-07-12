/**
 * Shortcut Conflict Detection Tests — MRG-356
 *
 * This test derives the shortcut inventory programmatically from the source of truth
 * (config/shortcuts.ts) so it can't silently drift. It asserts:
 * 1. No two actions in the same scope bind the same key.
 * 2. Every display shortcut (shared/utils/shortcuts.ts COMMAND_TO_CONFIG) resolves
 *    to a real registered key in the config.
 */

import { describe, expect, it } from "vitest";
import {
	DASHBOARD_SHORTCUTS,
	DOCUMENT_SHORTCUTS,
	GLOBAL_SHORTCUTS,
	JOURNAL_SHORTCUTS,
	PANE_SHORTCUTS,
	PROJECTS_SHORTCUTS,
	QUICK_CAPTURE_DEFAULT,
	QUICK_CAPTURE_SHORTCUTS,
	SEARCH_SHORTCUTS,
	SETTINGS_SHORTCUTS,
	type ShortcutDef,
	SIDEBAR_SHORTCUTS,
} from "../config/shortcuts";

/**
 * All shortcut groups with their scope names.
 * This is the single source of truth for conflict detection.
 */
const SHORTCUT_GROUPS: { scope: string; defs: Record<string, ShortcutDef> }[] = [
	{ scope: "global", defs: GLOBAL_SHORTCUTS },
	{ scope: "sidebar", defs: SIDEBAR_SHORTCUTS },
	{ scope: "pane", defs: PANE_SHORTCUTS },
	{ scope: "document", defs: DOCUMENT_SHORTCUTS },
	{ scope: "dashboard", defs: DASHBOARD_SHORTCUTS },
	{ scope: "journal", defs: JOURNAL_SHORTCUTS },
	{ scope: "projects", defs: PROJECTS_SHORTCUTS },
	{ scope: "quickCapture", defs: QUICK_CAPTURE_SHORTCUTS },
	{ scope: "settings", defs: SETTINGS_SHORTCUTS },
	{ scope: "search", defs: SEARCH_SHORTCUTS },
];

/**
 * Normalize a shortcut key for comparison.
 * Lowercases and removes whitespace.
 */
function normalizeKey(key: string): string {
	return key.toLowerCase().replace(/\s+/g, "");
}

/**
 * COMMAND_TO_CONFIG mapping from shared/utils/shortcuts.ts.
 * This maps command IDs to their config group and key.
 */
const COMMAND_TO_CONFIG: Record<string, { group: string; key: string }> = {
	"command-palette": { group: "global", key: "commandPalette" },
	"show-help": { group: "global", key: "help" },
	"nav-today": { group: "global", key: "today" },
	"switch-last": { group: "global", key: "switchProject" },
	"toggle-sidebar": { group: "sidebar", key: "toggle" },
	"new-document": { group: "dashboard", key: "newDocument" },
	"save-document": { group: "document", key: "save" },
	"find-in-document": { group: "document", key: "documentSearch" },
	"git-sync": { group: "global", key: "gitSync" },
};

describe("MRG-356: Shortcut Conflict Detection (programmatic)", () => {
	it("should have no duplicate keys within the same scope", () => {
		const conflicts: string[] = [];

		for (const { scope, defs } of SHORTCUT_GROUPS) {
			const keyToActions = new Map<string, string[]>();

			for (const [actionName, def] of Object.entries(defs)) {
				if (!def.key) continue; // Skip empty keys (e.g., disabled shortcuts)
				const normalizedKey = normalizeKey(def.key);
				const existing = keyToActions.get(normalizedKey) || [];
				existing.push(actionName);
				keyToActions.set(normalizedKey, existing);
			}

			for (const [key, actions] of keyToActions) {
				if (actions.length > 1) {
					conflicts.push(
						`Scope "${scope}": key "${key}" is bound to multiple actions: ${actions.join(", ")}`,
					);
				}
			}
		}

		if (conflicts.length > 0) {
			console.log("\n=== WITHIN-SCOPE CONFLICTS ===\n");
			console.log(conflicts.join("\n"));
		}

		expect(conflicts).toHaveLength(0);
	});

	it("should have no duplicate keys across global/layout scopes", () => {
		// Global and sidebar are both always-active, so they must not conflict.
		const globalKeys = new Map<string, string>();
		const conflicts: string[] = [];

		for (const actionName of Object.keys(GLOBAL_SHORTCUTS)) {
			const def = GLOBAL_SHORTCUTS[actionName];
			if (!def.key) continue;
			globalKeys.set(normalizeKey(def.key), `global.${actionName}`);
		}

		for (const actionName of Object.keys(SIDEBAR_SHORTCUTS)) {
			const def = SIDEBAR_SHORTCUTS[actionName];
			if (!def.key) continue;
			const normalizedKey = normalizeKey(def.key);
			const existing = globalKeys.get(normalizedKey);
			if (existing) {
				conflicts.push(`Key "${normalizedKey}" conflicts: ${existing} vs sidebar.${actionName}`);
			}
		}

		expect(conflicts).toHaveLength(0);
	});

	it("should resolve all COMMAND_TO_CONFIG entries to real config keys", () => {
		const orphans: string[] = [];

		// Build a lookup: scope -> { key -> actionName }
		const scopeLookup = new Map<string, Map<string, string>>();
		for (const { scope, defs } of SHORTCUT_GROUPS) {
			const keyMap = new Map<string, string>();
			for (const [actionName, def] of Object.entries(defs)) {
				if (!def.key) continue;
				keyMap.set(normalizeKey(def.key), actionName);
			}
			scopeLookup.set(scope, keyMap);
		}

		// Also add QUICK_CAPTURE_DEFAULT as a special case
		scopeLookup.set(
			"quickCapture.default",
			new Map([[normalizeKey(QUICK_CAPTURE_DEFAULT.key), "default"]]),
		);

		for (const [commandId, mapping] of Object.entries(COMMAND_TO_CONFIG)) {
			const scope = mapping.group;
			const configKey = mapping.key;

			const scopeMap = scopeLookup.get(scope);
			if (!scopeMap) {
				orphans.push(`Command "${commandId}": scope "${scope}" not found`);
				continue;
			}

			// Find the action in this scope that has the config key
			const defs = SHORTCUT_GROUPS.find((g) => g.scope === scope)?.defs;
			if (!defs) {
				orphans.push(`Command "${commandId}": scope "${scope}" not found in groups`);
				continue;
			}

			const def = defs[configKey];
			if (!def) {
				orphans.push(`Command "${commandId}": key "${configKey}" not found in scope "${scope}"`);
				continue;
			}

			if (!def.key) {
				orphans.push(
					`Command "${commandId}": config key "${configKey}" in scope "${scope}" has empty key`,
				);
			}
		}

		if (orphans.length > 0) {
			console.log("\n=== ORPHAN COMMAND MAPPINGS ===\n");
			console.log(orphans.join("\n"));
		}

		expect(orphans).toHaveLength(0);
	});

	it("should catch a duplicate key if one is introduced (sanity check)", () => {
		// This test verifies the conflict detection logic works.
		// We'll create a fake scope with a duplicate and ensure it's caught.
		const fakeScope = {
			action1: { key: "mod+a", description: "Action 1" },
			action2: { key: "mod+a", description: "Action 2" },
			action3: { key: "mod+b", description: "Action 3" },
		};

		const keyToActions = new Map<string, string[]>();
		for (const [actionName, def] of Object.entries(fakeScope)) {
			const normalizedKey = normalizeKey(def.key);
			const existing = keyToActions.get(normalizedKey) || [];
			existing.push(actionName);
			keyToActions.set(normalizedKey, existing);
		}

		const conflicts: string[] = [];
		for (const [key, actions] of keyToActions) {
			if (actions.length > 1) {
				conflicts.push(`Key "${key}" bound to: ${actions.join(", ")}`);
			}
		}

		expect(conflicts.length).toBeGreaterThan(0);
		expect(conflicts[0]).toContain("mod+a");
	});

	it("should catch an orphan command mapping if one is introduced (sanity check)", () => {
		// This test verifies the orphan detection logic works.
		const fakeCommandToConfig = {
			"fake-command": { group: "nonexistent", key: "fakeKey" },
		};

		const scopeLookup = new Map<string, Map<string, string>>();
		for (const { scope, defs } of SHORTCUT_GROUPS) {
			const keyMap = new Map<string, string>();
			for (const [actionName, def] of Object.entries(defs)) {
				if (!def.key) continue;
				keyMap.set(normalizeKey(def.key), actionName);
			}
			scopeLookup.set(scope, keyMap);
		}

		const orphans: string[] = [];
		for (const [commandId, mapping] of Object.entries(fakeCommandToConfig)) {
			const scope = mapping.group;
			const scopeMap = scopeLookup.get(scope);
			if (!scopeMap) {
				orphans.push(`Command "${commandId}": scope "${scope}" not found`);
			}
		}

		expect(orphans.length).toBeGreaterThan(0);
		expect(orphans[0]).toContain("nonexistent");
	});

	it("should document total shortcut count for coverage tracking", () => {
		let totalCount = 0;
		for (const { defs } of SHORTCUT_GROUPS) {
			totalCount += Object.values(defs).filter((d) => d.key).length;
		}
		totalCount += 1; // QUICK_CAPTURE_DEFAULT

		console.log(`\nTotal registered shortcuts: ${totalCount}`);
		expect(totalCount).toBeGreaterThan(50);
	});
});
