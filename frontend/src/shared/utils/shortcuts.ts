import { formatShortcutKeyForDisplay } from "@/config/shortcuts";
import { getMergedConfig } from "@/shared/stores/preferences.store";

type CommandId =
	| "nav-dashboard"
	| "nav-projects"
	| "nav-search"
	| "nav-journal"
	| "nav-settings"
	| "nav-today"
	| "new-document"
	| "git-sync"
	| "toggle-sidebar"
	| "command-palette"
	| "show-help"
	| "switch-last"
	| "save-document"
	| "find-in-document";

interface ShortcutMapping {
	key: string;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	metaKey?: boolean;
}

const COMMAND_TO_CONFIG: Partial<Record<CommandId, { group: string; key: string }>> = {
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
	"nav-today": { key: "T", ctrlKey: true },
	"switch-last": { key: "Tab", ctrlKey: true },
	"save-document": { key: "S", ctrlKey: true },
	"find-in-document": { key: "F", ctrlKey: true },
};

export function getShortcutForCommand(commandId: string): string | undefined {
	const mapping = COMMAND_TO_CONFIG[commandId as CommandId];
	if (mapping) {
		const config = getMergedConfig();
		const group = config.shortcuts[mapping.group as keyof typeof config.shortcuts];
		if (group) {
			const shortcutDef = (group as Record<string, { key: string }>)[mapping.key];
			if (shortcutDef?.key) {
				return formatShortcutKeyForDisplay(shortcutDef.key);
			}
		}
	}
	const staticMapping = COMMAND_KEYBOARD_MAPPINGS[commandId as CommandId];
	if (staticMapping) {
		const parts: string[] = [];
		if (staticMapping.ctrlKey) parts.push("mod");
		if (staticMapping.shiftKey) parts.push("shift");
		if (staticMapping.metaKey) parts.push("meta");
		parts.push(staticMapping.key);
		return formatShortcutKeyForDisplay(parts.join("+"));
	}
	return undefined;
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
