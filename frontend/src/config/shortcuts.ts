/**
 * Single source of truth for keyboard shortcuts.
 * Keys use Mantine useHotkey format (mod = Cmd on Mac, Ctrl on Win/Linux).
 * Used by hotkey registration and by Help/Settings display.
 */

export type ShortcutDef = { key: string; description: string };

/** Global app shortcuts (App.tsx, HelpModal) */
export const GLOBAL_SHORTCUTS = {
	help: { key: "shift+/", description: "Toggle help" },
	quit: { key: "ctrl+q", description: "Quit (background if enabled)" },
	forceQuit: { key: "ctrl+shift+q", description: "Force quit application" },
	commandPalette: { key: "mod+K", description: "Open command palette" },
	today: { key: "mod+T", description: "Jump to today's journal" },
	switchProject: { key: "ctrl+Tab", description: "Switch to last project" },
} as const satisfies Record<string, ShortcutDef>;

/** Sidebar (Layout.tsx) */
export const SIDEBAR_SHORTCUTS = {
	toggle: { key: "ctrl+b", description: "Toggle sidebar" },
} as const satisfies Record<string, ShortcutDef>;

/** Pane (PaneContent, usePaneHotkeys) */
export const PANE_SHORTCUTS = {
	documentPicker: { key: "alt+O", description: "Toggle document picker overlay" },
	splitRight: { key: "mod+\\", description: "Split pane right" },
	splitDown: { key: "mod+shift+\\", description: "Split pane down" },
	close: { key: "alt+x", description: "Close pane" },
	focusLeft: { key: "alt+h", description: "Focus pane left" },
	focusDown: { key: "alt+j", description: "Focus pane down" },
	focusUp: { key: "alt+k", description: "Focus pane up" },
	focusRight: { key: "alt+l", description: "Focus pane right" },
} as const satisfies Record<string, ShortcutDef>;

/** Document view (useDocumentController) */
export const DOCUMENT_SHORTCUTS = {
	save: { key: "mod+s", description: "Save document" },
	exportMd: { key: "mod+e", description: "Export to Markdown" },
	exportPdf: { key: "mod+shift+e", description: "Export to PDF" },
	back: { key: "Escape", description: "Unfocus editor, or go back to dashboard" },
	unfocus: { key: "mod+C", description: "Unfocus editor" },
	focusEditor: { key: "Enter", description: "Focus editor when unfocused" },
} as const satisfies Record<string, ShortcutDef>;

/** Dashboard (useDashboardController) */
export const DASHBOARD_SHORTCUTS = {
	newDocument: { key: "mod+N", description: "Create new document" },
	toggleArchived: { key: "mod+shift+A", description: "Toggle archived documents view" },
	softDelete: { key: "mod+D", description: "Soft delete selected documents" },
	permanentDelete: { key: "mod+shift+D", description: "Permanently delete selected documents" },
	toggleSelection: { key: "Space", description: "Select/deselect highlighted document" },
	openHighlighted: { key: "Enter", description: "Open highlighted document" },
	highlightNext: { key: "j", description: "Highlight next document" },
	highlightPrev: { key: "k", description: "Highlight previous document" },
	navigateDown: { key: "ArrowDown", description: "Navigate down" },
	navigateUp: { key: "ArrowUp", description: "Navigate up" },
	move: { key: "mod+M", description: "Move selected documents to another project" },
	archive: { key: "mod+A", description: "Archive selected documents" },
	restore: { key: "mod+U", description: "Restore archived documents" },
	exportMd: { key: "mod+E", description: "Export selected documents to markdown" },
	exportPdf: { key: "mod+shift+E", description: "Export selected documents to PDF" },
} as const satisfies Record<string, ShortcutDef>;

/** Journal (useJournalController) */
export const JOURNAL_SHORTCUTS = {
	nextDay: { key: "ctrl+n", description: "Next day" },
	prevDay: { key: "ctrl+p", description: "Previous day" },
	arrowNextDay: { key: "ArrowRight", description: "Next day" },
	arrowPrevDay: { key: "ArrowLeft", description: "Previous day" },
	highlightNext: { key: "j", description: "Highlight next entry" },
	highlightPrev: { key: "k", description: "Highlight previous entry" },
	navigateDown: { key: "ArrowDown", description: "Navigate down" },
	navigateUp: { key: "ArrowUp", description: "Navigate up" },
	toggleSelection: { key: "Space", description: "Select/deselect highlighted entry" },
	delete: { key: "mod+D", description: "Delete selected entries" },
	promote: { key: "mod+shift+p", description: "Promote selected entries to document" },
} as const satisfies Record<string, ShortcutDef>;

/** Projects (Projects.tsx) */
export const PROJECTS_SHORTCUTS = {
	newProject: { key: "mod+N", description: "Create new project" },
	selectNext: { key: "j", description: "Select next project" },
	selectPrev: { key: "k", description: "Select previous project" },
	arrowDown: { key: "ArrowDown", description: "Select next project" },
	arrowUp: { key: "ArrowUp", description: "Select previous project" },
	switchToSelected: { key: "Enter", description: "Switch to selected project" },
	archive: { key: "mod+A", description: "Archive selected project" },
	restore: { key: "mod+U", description: "Restore archived project" },
	delete: { key: "mod+D", description: "Delete selected project" },
	permanentDelete: { key: "mod+shift+D", description: "Permanently delete selected project" },
} as const satisfies Record<string, ShortcutDef>;

/** Quick capture (QuickCapture.tsx) */
export const QUICK_CAPTURE_SHORTCUTS = {
	save: { key: "ctrl+enter", description: "Save and close" },
	saveAndStay: { key: "shift+enter", description: "Save and stay" },
	cancel: { key: "Escape", description: "Cancel / discard" },
} as const satisfies Record<string, ShortcutDef>;

/** Default quick capture hotkey (user-configurable in settings). Full ShortcutDef for display in Help/Settings. */
export const QUICK_CAPTURE_DEFAULT: ShortcutDef = {
	key: "ctrl+shift+n",
	description: "Open Quick Capture",
};

/** Settings (useSettingsController default, Settings.tsx nav) */
export const SETTINGS_SHORTCUTS = {
	navNext: { key: "j", description: "Next section" },
	navPrev: { key: "k", description: "Previous section" },
} as const satisfies Record<string, ShortcutDef>;

/** Key part → display string for formatShortcutKeyForDisplay (hoisted to avoid per-call allocation). */
const KEY_DISPLAY_MAP: Record<string, string> = {
	Escape: "ESC",
	" ": "SPACE",
	Enter: "ENTER",
	Tab: "TAB",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
};

/**
 * Format hotkey string for display (e.g. "mod+K" → "Ctrl+K", "Escape" → "ESC").
 * Use in Settings and Help modal so display matches config keys.
 */
export function formatShortcutKeyForDisplay(key: string): string {
	return key
		.replace(/mod/gi, "Ctrl")
		.replace(/shift/gi, "Shift")
		.replace(/alt/gi, "Alt")
		.replace(/meta/gi, "Meta")
		.replace(/\+/g, "+")
		.split("+")
		.map((part) => KEY_DISPLAY_MAP[part] || part.toUpperCase())
		.join("+");
}

/** Flatten all config shortcuts for Settings table. IDs use config key names (e.g. global.help) for stable, safe identifiers. */
export function getShortcutsForSettings(): { id: string; action: string; key: string }[] {
	const entries: { id: string; action: string; key: string }[] = [];

	const pushAll = (group: string, defs: Record<string, ShortcutDef>) => {
		for (const [name, def] of Object.entries(defs)) {
			entries.push({ id: `${group}.${name}`, action: def.description, key: def.key });
		}
	};

	pushAll("global", GLOBAL_SHORTCUTS);
	pushAll("sidebar", SIDEBAR_SHORTCUTS);
	pushAll("document", DOCUMENT_SHORTCUTS);
	pushAll("dashboard", DASHBOARD_SHORTCUTS);
	pushAll("journal", JOURNAL_SHORTCUTS);
	pushAll("projects", PROJECTS_SHORTCUTS);
	entries.push({
		id: "quickCapture.default",
		action: QUICK_CAPTURE_DEFAULT.description,
		key: QUICK_CAPTURE_DEFAULT.key,
	});
	pushAll("quickCapture", QUICK_CAPTURE_SHORTCUTS);
	pushAll("settings", SETTINGS_SHORTCUTS);
	pushAll("pane", PANE_SHORTCUTS);

	return entries;
}

/** Help modal section items derived from config (key formatted for display). Editor left empty so it is filled only by runtime-registered hotkeys (avoids duplication). */
export function getHelpShortcutsFromConfig(): {
	global: { key: string; description: string }[];
	documents: { key: string; description: string }[];
	journal: { key: string; description: string }[];
	editor: { key: string; description: string }[];
} {
	const fmt = (d: ShortcutDef) => ({
		key: formatShortcutKeyForDisplay(d.key),
		description: d.description,
	});
	return {
		global: [
			...Object.values(GLOBAL_SHORTCUTS).map(fmt),
			...Object.values(SIDEBAR_SHORTCUTS).map(fmt),
		],
		documents: [fmt(DASHBOARD_SHORTCUTS.newDocument), fmt(DOCUMENT_SHORTCUTS.save)],
		journal: [fmt(JOURNAL_SHORTCUTS.prevDay), fmt(JOURNAL_SHORTCUTS.nextDay)],
		editor: [],
	};
}

/** All shortcut keys flattened for conflict checks (e.g. shortcut-conflicts.test). */
export const ALL_SHORTCUT_KEYS = [
	...Object.values(GLOBAL_SHORTCUTS).map((s) => s.key),
	...Object.values(SIDEBAR_SHORTCUTS).map((s) => s.key),
	...Object.values(PANE_SHORTCUTS).map((s) => s.key),
	...Object.values(DOCUMENT_SHORTCUTS).map((s) => s.key),
	...Object.values(DASHBOARD_SHORTCUTS).map((s) => s.key),
	...Object.values(JOURNAL_SHORTCUTS).map((s) => s.key),
	...Object.values(PROJECTS_SHORTCUTS).map((s) => s.key),
	...Object.values(QUICK_CAPTURE_SHORTCUTS).map((s) => s.key),
	QUICK_CAPTURE_DEFAULT.key,
	...Object.values(SETTINGS_SHORTCUTS).map((s) => s.key),
] as const;
