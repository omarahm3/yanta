/**
 * Types for user preferences overrides.
 * Uses camelCase for frontend; backend bindings use PascalCase.
 */

export interface PreferencesTimeoutsOverrides {
	autoSaveDebounceMs?: number;
	tooltipHoverDelay?: number;
	tooltipFocusDelay?: number;
	scrollDebounceMs?: number;
	searchDebounceMs?: number;
	savePersistenceDebounceMs?: number;
}

export interface PreferencesShortcutsOverrides {
	global?: Record<string, string>;
	sidebar?: Record<string, string>;
	document?: Record<string, string>;
	dashboard?: Record<string, string>;
	journal?: Record<string, string>;
	projects?: Record<string, string>;
	quickCapture?: Record<string, string>;
	settings?: Record<string, string>;
	commandLine?: Record<string, string>;
	search?: Record<string, string>;
	pane?: Record<string, string>;
}

export interface PreferencesLayoutOverrides {
	maxPanes?: number;
}

export interface PreferencesPluginOverrides {
	[pluginId: string]: Record<string, unknown>;
}

export interface PreferencesOverrides {
	timeouts?: PreferencesTimeoutsOverrides;
	shortcuts?: PreferencesShortcutsOverrides;
	layout?: PreferencesLayoutOverrides;
	plugins?: PreferencesPluginOverrides;
}

/** Convert backend (PascalCase) model to frontend (camelCase) format. */
export function preferencesFromModel(model: {
	Timeouts?: {
		AutoSaveDebounceMs?: number;
		TooltipHoverDelay?: number;
		TooltipFocusDelay?: number;
		ScrollDebounceMs?: number;
		SearchDebounceMs?: number;
		SavePersistenceDebounceMs?: number;
	};
	Shortcuts?: Record<string, Record<string, string>>;
	Layout?: { MaxPanes?: number };
	Plugins?: Record<string, Record<string, unknown>>;
}): PreferencesOverrides {
	const overrides: PreferencesOverrides = {};
	if (model.Timeouts) {
		const t = model.Timeouts;
		overrides.timeouts = {};
		if (t.AutoSaveDebounceMs) overrides.timeouts.autoSaveDebounceMs = t.AutoSaveDebounceMs;
		if (t.TooltipHoverDelay) overrides.timeouts.tooltipHoverDelay = t.TooltipHoverDelay;
		if (t.TooltipFocusDelay) overrides.timeouts.tooltipFocusDelay = t.TooltipFocusDelay;
		if (t.ScrollDebounceMs) overrides.timeouts.scrollDebounceMs = t.ScrollDebounceMs;
		if (t.SearchDebounceMs) overrides.timeouts.searchDebounceMs = t.SearchDebounceMs;
		if (t.SavePersistenceDebounceMs)
			overrides.timeouts.savePersistenceDebounceMs = t.SavePersistenceDebounceMs;
	}
	if (model.Shortcuts) {
		overrides.shortcuts = {};
		const keyMap: Record<string, string> = {
			Global: "global",
			Sidebar: "sidebar",
			Document: "document",
			Dashboard: "dashboard",
			Journal: "journal",
			Projects: "projects",
			QuickCapture: "quickCapture",
			Settings: "settings",
			CommandLine: "commandLine",
			Search: "search",
			Pane: "pane",
		};
		for (const [k, v] of Object.entries(model.Shortcuts)) {
			const camel = keyMap[k] ?? k;
			if (v && typeof v === "object" && Object.keys(v).length > 0) {
				overrides.shortcuts[camel as keyof PreferencesShortcutsOverrides] = v;
			}
		}
	}
	if (model.Layout?.MaxPanes) {
		overrides.layout = { maxPanes: model.Layout.MaxPanes };
	}
	if (model.Plugins && typeof model.Plugins === "object" && Object.keys(model.Plugins).length > 0) {
		overrides.plugins = model.Plugins as PreferencesPluginOverrides;
	}
	return overrides;
}

/** Convert frontend (camelCase) format to backend (PascalCase) model. */
export function preferencesToModel(overrides: PreferencesOverrides): {
	Timeouts: Record<string, number>;
	Shortcuts: Record<string, Record<string, string>>;
	Layout: Record<string, number>;
	Plugins: Record<string, Record<string, unknown>>;
} {
	const model: {
		Timeouts: Record<string, number>;
		Shortcuts: Record<string, Record<string, string>>;
		Layout: Record<string, number>;
		Plugins: Record<string, Record<string, unknown>>;
	} = {
		Timeouts: {},
		Shortcuts: {},
		Layout: {},
		Plugins: {},
	};
	if (overrides.timeouts) {
		const t = overrides.timeouts;
		if (t.autoSaveDebounceMs) model.Timeouts.AutoSaveDebounceMs = t.autoSaveDebounceMs;
		if (t.tooltipHoverDelay) model.Timeouts.TooltipHoverDelay = t.tooltipHoverDelay;
		if (t.tooltipFocusDelay) model.Timeouts.TooltipFocusDelay = t.tooltipFocusDelay;
		if (t.scrollDebounceMs) model.Timeouts.ScrollDebounceMs = t.scrollDebounceMs;
		if (t.searchDebounceMs) model.Timeouts.SearchDebounceMs = t.searchDebounceMs;
		if (t.savePersistenceDebounceMs)
			model.Timeouts.SavePersistenceDebounceMs = t.savePersistenceDebounceMs;
	}
	if (overrides.shortcuts) {
		const keyMap: Record<string, string> = {
			global: "Global",
			sidebar: "Sidebar",
			document: "Document",
			dashboard: "Dashboard",
			journal: "Journal",
			projects: "Projects",
			quickCapture: "QuickCapture",
			settings: "Settings",
			commandLine: "CommandLine",
			search: "Search",
			pane: "Pane",
		};
		for (const [k, v] of Object.entries(overrides.shortcuts)) {
			if (v && typeof v === "object" && Object.keys(v).length > 0) {
				const pascal = keyMap[k] ?? k;
				model.Shortcuts[pascal] = v;
			}
		}
	}
	if (overrides.layout?.maxPanes) {
		model.Layout.MaxPanes = overrides.layout.maxPanes;
	}
	if (
		overrides.plugins &&
		typeof overrides.plugins === "object" &&
		Object.keys(overrides.plugins).length > 0
	) {
		model.Plugins = overrides.plugins;
	}
	return model;
}
