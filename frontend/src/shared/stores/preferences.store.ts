import { create } from "zustand";
import { LAYOUT } from "../../config/layout";
import type { PreferencesOverrides } from "../../config/preferences";
import type { LinuxGraphicsMode } from "../../config/preferences";
import type { ShortcutDef } from "../../config/shortcuts";
import {
	COMMAND_LINE_SHORTCUTS,
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
	SIDEBAR_SHORTCUTS,
} from "../../config/shortcuts";
import { TIMEOUTS } from "../../config/timeouts";
import { getPreferencesOverrides, setPreferencesOverrides } from "../services/ConfigService";
import { BackendLogger } from "../utils/backendLogger";

export interface MergedTimeouts {
	tooltipHoverDelay: number;
	tooltipFocusDelay: number;
	tooltipOffset: number;
	scrollDebounceMs: number;
	autoSaveDebounceMs: number;
	autoSaveMaxRetries: number;
	autoSaveRetryBaseMs: number;
	savedStateDisplayMs: number;
	welcomeDelayMs: number;
	savePersistenceDebounceMs: number;
	searchDebounceMs: number;
	documentPickerFilterDebounceMs: number;
	focusRestoreMs: number;
	gitErrorDismissMs: number;
	helpAnnounceDelayMs: number;
	milestoneAnimationMs: number;
}

export interface MergedLayout {
	maxPanes: number;
}

export interface MergedGraphics {
	linuxMode: LinuxGraphicsMode;
}

export interface MergedShortcuts {
	global: Record<string, ShortcutDef>;
	sidebar: Record<string, ShortcutDef>;
	document: Record<string, ShortcutDef>;
	dashboard: Record<string, ShortcutDef>;
	journal: Record<string, ShortcutDef>;
	projects: Record<string, ShortcutDef>;
	quickCapture: Record<string, ShortcutDef> & { default: ShortcutDef };
	settings: Record<string, ShortcutDef>;
	commandLine: Record<string, ShortcutDef>;
	search: Record<string, ShortcutDef>;
	pane: Record<string, ShortcutDef>;
}

export interface MergedConfig {
	timeouts: MergedTimeouts;
	layout: MergedLayout;
	graphics: MergedGraphics;
	shortcuts: MergedShortcuts;
}

const DEFAULT_SHORTCUTS = {
	global: GLOBAL_SHORTCUTS,
	sidebar: SIDEBAR_SHORTCUTS,
	document: DOCUMENT_SHORTCUTS,
	dashboard: DASHBOARD_SHORTCUTS,
	journal: JOURNAL_SHORTCUTS,
	projects: PROJECTS_SHORTCUTS,
	quickCapture: { ...QUICK_CAPTURE_SHORTCUTS, default: QUICK_CAPTURE_DEFAULT },
	settings: SETTINGS_SHORTCUTS,
	commandLine: COMMAND_LINE_SHORTCUTS,
	search: SEARCH_SHORTCUTS,
	pane: PANE_SHORTCUTS,
} as const;

function mergeTimeouts(overrides?: PreferencesOverrides["timeouts"]): MergedTimeouts {
	return {
		...TIMEOUTS,
		autoSaveDebounceMs:
			overrides?.autoSaveDebounceMs !== undefined
				? overrides.autoSaveDebounceMs
				: TIMEOUTS.autoSaveDebounceMs,
		tooltipHoverDelay:
			overrides?.tooltipHoverDelay !== undefined
				? overrides.tooltipHoverDelay
				: TIMEOUTS.tooltipHoverDelay,
		tooltipFocusDelay:
			overrides?.tooltipFocusDelay !== undefined
				? overrides.tooltipFocusDelay
				: TIMEOUTS.tooltipFocusDelay,
		scrollDebounceMs:
			overrides?.scrollDebounceMs !== undefined
				? overrides.scrollDebounceMs
				: TIMEOUTS.scrollDebounceMs,
		searchDebounceMs:
			overrides?.searchDebounceMs !== undefined
				? overrides.searchDebounceMs
				: TIMEOUTS.searchDebounceMs,
		savePersistenceDebounceMs:
			overrides?.savePersistenceDebounceMs !== undefined
				? overrides.savePersistenceDebounceMs
				: TIMEOUTS.savePersistenceDebounceMs,
	};
}

function mergeLayout(overrides?: PreferencesOverrides["layout"]): MergedLayout {
	return {
		maxPanes: overrides?.maxPanes ?? LAYOUT.maxPanes,
	};
}

function mergeGraphics(overrides?: PreferencesOverrides["graphics"]): MergedGraphics {
	return {
		linuxMode: overrides?.linuxMode ?? "auto",
	};
}

function mergeShortcuts(overrides?: PreferencesOverrides["shortcuts"]): MergedShortcuts {
	const result: MergedShortcuts = {
		global: { ...DEFAULT_SHORTCUTS.global },
		sidebar: { ...DEFAULT_SHORTCUTS.sidebar },
		document: { ...DEFAULT_SHORTCUTS.document },
		dashboard: { ...DEFAULT_SHORTCUTS.dashboard },
		journal: { ...DEFAULT_SHORTCUTS.journal },
		projects: { ...DEFAULT_SHORTCUTS.projects },
		quickCapture: { ...DEFAULT_SHORTCUTS.quickCapture },
		settings: { ...DEFAULT_SHORTCUTS.settings },
		commandLine: { ...DEFAULT_SHORTCUTS.commandLine },
		search: { ...DEFAULT_SHORTCUTS.search },
		pane: { ...DEFAULT_SHORTCUTS.pane },
	};
	if (!overrides) return result;
	const groups = [
		"global",
		"sidebar",
		"document",
		"dashboard",
		"journal",
		"projects",
		"quickCapture",
		"settings",
		"commandLine",
		"search",
		"pane",
	] as const;
	for (const group of groups) {
		const groupOverrides = overrides[group];
		if (groupOverrides && typeof groupOverrides === "object") {
			const target = result[group];
			for (const [key, keyCombo] of Object.entries(groupOverrides)) {
				if (keyCombo && key in target) {
					(target as Record<string, ShortcutDef>)[key] = {
						...target[key as keyof typeof target],
						key: keyCombo,
					};
				}
			}
		}
	}
	return result;
}

interface PreferencesState {
	overrides: PreferencesOverrides | null;
	isLoading: boolean;
	loadOverrides: () => Promise<void>;
	saveOverrides: (overrides: PreferencesOverrides) => Promise<void>;
	getMergedConfig: () => MergedConfig;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
	overrides: null,
	isLoading: true,

	loadOverrides: async () => {
		try {
			const o = await getPreferencesOverrides();
			set({ overrides: o, isLoading: false });
		} catch (err) {
			BackendLogger.error("[preferences.store] Failed to load:", err);
			set({ isLoading: false });
		}
	},

	saveOverrides: async (newOverrides: PreferencesOverrides) => {
		try {
			// Merge with existing so we don't wipe other sections
			const existing = get().overrides ?? {};
			const mergedShortcuts: PreferencesOverrides["shortcuts"] = {};
			for (const group of [
				"global",
				"sidebar",
				"document",
				"dashboard",
				"journal",
				"projects",
				"quickCapture",
				"settings",
				"commandLine",
				"search",
				"pane",
			] as const) {
				const existingGroup = existing.shortcuts?.[group];
				const newGroup = newOverrides.shortcuts?.[group];
				if (newGroup && Object.keys(newGroup).length > 0) {
					mergedShortcuts[group] = { ...existingGroup, ...newGroup };
				} else if (existingGroup) {
					mergedShortcuts[group] = existingGroup;
				}
			}
			const mergedPlugins: PreferencesOverrides["plugins"] = { ...existing.plugins };
			if (newOverrides.plugins && typeof newOverrides.plugins === "object") {
				for (const [pluginId, pluginConfig] of Object.entries(newOverrides.plugins)) {
					if (pluginConfig && typeof pluginConfig === "object") {
						mergedPlugins[pluginId] = {
							...mergedPlugins[pluginId],
							...pluginConfig,
						};
					}
				}
			}
			const merged: PreferencesOverrides = {
				timeouts: { ...existing.timeouts, ...newOverrides.timeouts },
				shortcuts: Object.keys(mergedShortcuts).length > 0 ? mergedShortcuts : undefined,
				layout: { ...existing.layout, ...newOverrides.layout },
				graphics: { ...existing.graphics, ...newOverrides.graphics },
				plugins: Object.keys(mergedPlugins).length > 0 ? mergedPlugins : undefined,
			};
			await setPreferencesOverrides(merged);
			set({ overrides: merged });
		} catch (err) {
			BackendLogger.error("[preferences.store] Failed to save:", err);
			throw err;
		}
	},

	getMergedConfig: () => {
		const { overrides } = get();
		return {
			timeouts: mergeTimeouts(overrides?.timeouts),
			layout: mergeLayout(overrides?.layout),
			graphics: mergeGraphics(overrides?.graphics),
			shortcuts: mergeShortcuts(overrides?.shortcuts),
		};
	},
}));

export function useMergedConfig(): MergedConfig {
	const overrides = usePreferencesStore((s) => s.overrides);
	return {
		timeouts: mergeTimeouts(overrides?.timeouts),
		layout: mergeLayout(overrides?.layout),
		graphics: mergeGraphics(overrides?.graphics),
		shortcuts: mergeShortcuts(overrides?.shortcuts),
	};
}

/** Get merged config from store (for use in non-React code such as zustand stores). */
export function getMergedConfig(): MergedConfig {
	const overrides = usePreferencesStore.getState().overrides;
	return {
		timeouts: mergeTimeouts(overrides?.timeouts),
		layout: mergeLayout(overrides?.layout),
		graphics: mergeGraphics(overrides?.graphics),
		shortcuts: mergeShortcuts(overrides?.shortcuts),
	};
}
