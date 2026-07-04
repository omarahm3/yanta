import { Bug, HelpCircle, PanelLeft, RotateCcw } from "lucide-react";
import type { CommandOption } from "../../../shared/ui";
import { getShortcutForCommand } from "../../../shared/utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerApplicationCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const { onNavigate, handleClose, onToggleSidebar, onShowHelp, resetLayout } = ctx;
	const commands: CommandOption[] = [
		{
			id: "reset-panes",
			icon: <RotateCcw className="text-lg" />,
			text: "Reset Panes",
			hint: "Single pane layout",
			group: "Application",
			keywords: ["reset", "pane", "split", "layout", "default", "single"],
			action: () => {
				resetLayout();
				handleClose();
			},
		},
	];

	// The BlockNote/Wayland debug page is a dev-only tool; keep it out of
	// production builds and the command palette. See bnote-stable.md P4.6.
	if (import.meta.env.DEV) {
		commands.unshift({
			id: "nav-test",
			icon: <Bug className="text-lg" />,
			text: "Open Development Test",
			hint: "Debug tools",
			group: "Application",
			action: () => {
				onNavigate("test");
				handleClose();
			},
		});
	}

	if (onToggleSidebar) {
		commands.push({
			id: "toggle-sidebar",
			icon: <PanelLeft className="text-lg" />,
			text: "Toggle Sidebar",
			shortcut: getShortcutForCommand("toggle-sidebar"),
			group: "Application",
			action: () => {
				onToggleSidebar();
				handleClose();
			},
		});
	}

	if (onShowHelp) {
		commands.push({
			id: "show-help",
			icon: <HelpCircle className="text-lg" />,
			text: "Show Keyboard Shortcuts",
			shortcut: getShortcutForCommand("show-help"),
			group: "Application",
			keywords: ["help", "shortcuts", "hotkeys", "keys"],
			action: () => {
				onShowHelp();
				handleClose();
			},
		});
	}

	registry.setCommands("application", commands);
}
