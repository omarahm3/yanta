/**
 * Editor Commands - Help commands for entry editor
 * Single Responsibility: Define editor keyboard shortcuts and help text
 */

import type { HelpCommand } from "../shared/types";

export const EDITOR_HELP_COMMANDS: HelpCommand[] = [
	{ command: "Ctrl+S", description: "Save the entry" },
	{ command: "Esc", description: "Cancel and go back" },
	{ command: "Ctrl+Shift+E", description: "Export to PDF" },
	{ command: "Alt+Z", description: "Toggle focus/typewriter mode" },
	{ command: "Ctrl+D", description: "Delete block" },
	{ command: "Mod+Shift+↑", description: "Move block up" },
	{ command: "Mod+Shift+↓", description: "Move block down" },
	{ command: "Mod+Shift+D", description: "Duplicate block" },
	{ command: "Mod+Shift+O", description: "Toggle document outline" },
];

export const EDITOR_SHORTCUTS = [
	{ key: "Ctrl+S", label: "save" },
	{ key: "Esc", label: "cancel" },
	{ key: "Ctrl+Shift+E", label: "export-pdf" },
	{ key: "Ctrl+D", label: "delete-block" },
	{ key: "Mod+Shift+ArrowUp", label: "move-block-up" },
	{ key: "Mod+Shift+ArrowDown", label: "move-block-down" },
	{ key: "Mod+Shift+D", label: "duplicate-block" },
	{ key: "Mod+Shift+O", label: "toggle-outline" },
];
