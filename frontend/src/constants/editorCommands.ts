/**
 * Editor Commands - Help commands for entry editor
 * Single Responsibility: Define editor keyboard shortcuts and help text
 */

import type { HelpCommand } from "../types";

export const EDITOR_HELP_COMMANDS: HelpCommand[] = [
	{ command: "Ctrl+S", description: "Save the entry" },
	{ command: "Esc", description: "Cancel and go back" },
];

export const EDITOR_SHORTCUTS = [
	{ key: "Ctrl+S", label: "save" },
	{ key: "Esc", label: "cancel" },
];
