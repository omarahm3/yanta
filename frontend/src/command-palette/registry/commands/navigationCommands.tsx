import { BookOpen, Calendar, Clock, Folder, LayoutDashboard, Search, Settings } from "lucide-react";
import type { CommandOption } from "../../../shared/ui";
import { getShortcutForCommand } from "../../../shared/utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerNavigationCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const { onNavigate, handleClose, setShowRecentDocuments } = ctx;
	const commands: CommandOption[] = [
		{
			id: "nav-dashboard",
			icon: <LayoutDashboard className="text-lg" />,
			text: "Go to Documents",
			hint: "Home",
			shortcut: getShortcutForCommand("nav-dashboard"),
			group: "Navigation",
			keywords: ["home", "main", "list", "documents"],
			action: () => {
				onNavigate("dashboard");
				handleClose();
			},
		},
		{
			id: "nav-projects",
			icon: <Folder className="text-lg" />,
			text: "Go to Projects",
			hint: "Manage projects",
			shortcut: getShortcutForCommand("nav-projects"),
			group: "Navigation",
			action: () => {
				onNavigate("projects");
				handleClose();
			},
		},
		{
			id: "nav-search",
			icon: <Search className="text-lg" />,
			text: "Go to Search",
			hint: "Find documents",
			shortcut: getShortcutForCommand("nav-search"),
			group: "Navigation",
			keywords: ["find", "lookup"],
			action: () => {
				onNavigate("search");
				handleClose();
			},
		},
		{
			id: "nav-journal",
			icon: <BookOpen className="text-lg" />,
			text: "Go to Journal",
			hint: "Quick notes",
			shortcut: getShortcutForCommand("nav-journal"),
			group: "Navigation",
			keywords: ["diary", "daily", "notes", "log"],
			action: () => {
				onNavigate("journal");
				handleClose();
			},
		},
		{
			id: "nav-settings",
			icon: <Settings className="text-lg" />,
			text: "Go to Settings",
			hint: "Configure app",
			shortcut: getShortcutForCommand("nav-settings"),
			group: "Navigation",
			keywords: ["preferences", "config", "options"],
			action: () => {
				onNavigate("settings");
				handleClose();
			},
		},
		{
			id: "nav-recent",
			icon: <Clock className="text-lg" />,
			text: "Recent Documents",
			shortcut: getShortcutForCommand("nav-recent"),
			group: "Navigation",
			keywords: ["recent", "history", "opened"],
			keepOpen: true,
			action: () => {
				setShowRecentDocuments(true);
			},
		},
		{
			id: "nav-today",
			icon: <Calendar className="text-lg" />,
			text: "Jump to Today's Journal",
			shortcut: getShortcutForCommand("nav-today"),
			group: "Navigation",
			keywords: ["today", "daily", "current"],
			action: () => {
				const today = new Date().toISOString().split("T")[0];
				onNavigate("journal", { date: today });
				handleClose();
			},
		},
	];
	registry.setCommands("navigation", commands);
}
