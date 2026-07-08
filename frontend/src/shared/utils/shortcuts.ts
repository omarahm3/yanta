import { formatShortcutKeyForDisplay } from "@/config/shortcuts";
import { getMergedConfig } from "@/shared/stores/preferences.store";

type CommandId =
	| "nav-dashboard"
	| "nav-projects"
	| "nav-search"
	| "nav-journal"
	| "nav-settings"
	| "nav-recent"
	| "nav-today"
	| "new-document"
	| "git-sync"
	| "toggle-sidebar"
	| "command-palette"
	| "show-help"
	| "switch-last"
	| "save-document";

interface ShortcutMapping {
	key: string;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	metaKey?: boolean;
}

const COMMAND_TO_CONFIG: Record<CommandId, { group: string; key: string }> = {
	"command-palette": { group: "global", key: "commandPalette" },
	"show-help": { group: "global", key: "help" },
	"nav-today": { group: "global", key: "today" },
	"switch-last": { group: "global", key: "switchProject" },
	"nav-dashboard": { group: "global", key: "globalSearch" },
	"toggle-sidebar": { group: "sidebar", key: "toggle" },
	"new-document": { group: "dashboard", key: "newDocument" },
	"save-document": { group: "document", key: "save" },
	"nav-journal": { group: "journal", key: "nextDay" },
	"nav-search": { group: "search", key: "focusInput" },
	"nav-projects": { group: "projects", key: "newProject" },
	"nav-settings": { group: "settings", key: "navNext" },
	"nav-recent": { group: "document", key: "exportMd" },
	"git-sync": { group: "global", key: "globalSearch" },
};

const COMMAND_KEYBOARD_MAPPINGS: Record<CommandId, ShortcutMapping> = {
	"nav-journal": { key: "J", ctrlKey: true },
	"nav-search": { key: "F", ctrlKey: true, shiftKey: true },
	"new-document": { key: "N", ctrlKey: true },
	"nav-settings": { key: ",", ctrlKey: true },
	"git-sync": { key: "S", ctrlKey: true, shiftKey: true },
	"nav-dashboard": { key: "D", ctrlKey: true },
	"nav-projects": { key: "P", ctrlKey: true, shiftKey: true },
	"toggle-sidebar": { key: "B", ctrlKey: true },
	"command-palette": { key: "K", ctrlKey: true },
	"show-help": { key: "?" },
	"nav-recent": { key: "E", ctrlKey: true },
	"nav-today": { key: "T", ctrlKey: true },
	"switch-last": { key: "Tab", ctrlKey: true },
	"save-document": { key: "S", ctrlKey: true },
};

export function getShortcutForCommand(commandId: string): string | undefined {
	const mapping = COMMAND_TO_CONFIG[commandId as CommandId];
	if (!mapping) return undefined;
	const config = getMergedConfig();
	const group = config.shortcuts[mapping.group as keyof typeof config.shortcuts];
	if (!group) return undefined;
	const shortcutDef = (group as Record<string, { key: string }>)[mapping.key];
	if (!shortcutDef?.key) return undefined;
	return formatShortcutKeyForDisplay(shortcutDef.key);
}

export function getCommandIdForKeyboardEvent(event: KeyboardEvent): CommandId | undefined {
	const mod = event.ctrlKey || event.metaKey;
	for (const [id, mapping] of Object.entries(COMMAND_KEYBOARD_MAPPINGS) as [
		CommandId,
		ShortcutMapping,
	][]) {
		const modMatch = mapping.ctrlKey ? mod : !mod;
		const shiftMatch = mapping.shiftKey === undefined ? true : !!mapping.shiftKey === event.shiftKey;
		const keyMatch =
			event.key.toUpperCase() === mapping.key ||
			(event.key === "?" && mapping.key === "?") ||
			(event.key === "," && mapping.key === ",");
		if (modMatch && shiftMatch && keyMatch) {
			return id;
		}
	}
	return undefined;
}
