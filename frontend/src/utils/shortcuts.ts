type CommandId =
	| "nav-dashboard"
	| "nav-projects"
	| "nav-search"
	| "nav-journal"
	| "nav-settings"
	| "nav-recent"
	| "new-document"
	| "git-sync"
	| "toggle-sidebar"
	| "show-help";

interface ShortcutMapping {
	key: string;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	metaKey?: boolean;
}

const COMMAND_SHORTCUTS: Record<CommandId, ShortcutMapping> = {
	"nav-journal": { key: "J", ctrlKey: true },
	"nav-search": { key: "F", ctrlKey: true, shiftKey: true },
	"new-document": { key: "N", ctrlKey: true },
	"nav-settings": { key: ",", ctrlKey: true },
	"git-sync": { key: "S", ctrlKey: true, shiftKey: true },
	"nav-dashboard": { key: "D", ctrlKey: true },
	"nav-projects": { key: "P", ctrlKey: true, shiftKey: true },
	"toggle-sidebar": { key: "B", ctrlKey: true },
	"show-help": { key: "?" },
	"nav-recent": { key: "E", ctrlKey: true },
};

function isMacOS(): boolean {
	if (typeof navigator === "undefined") {
		return false;
	}
	return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

function formatShortcut(mapping: ShortcutMapping): string {
	const isMac = isMacOS();
	const parts: string[] = [];

	if (mapping.ctrlKey) {
		parts.push(isMac ? "⌘" : "Ctrl");
	}
	if (mapping.shiftKey) {
		parts.push(isMac ? "⇧" : "Shift");
	}

	parts.push(mapping.key);

	return isMac ? parts.join("") : parts.join("+");
}

export function getShortcutForCommand(commandId: string): string | undefined {
	const mapping = COMMAND_SHORTCUTS[commandId as CommandId];
	if (!mapping) {
		return undefined;
	}
	return formatShortcut(mapping);
}
