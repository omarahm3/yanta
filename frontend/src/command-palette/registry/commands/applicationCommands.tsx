import {
	ArrowDown,
	Bug,
	HelpCircle,
	Moon,
	PanelLeft,
	PenLine,
	RotateCcw,
	Search,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useGlobalSearchStore } from "../../../global-search/globalSearch.store";
import { useSearchIndexStore } from "../../../search-index/searchIndex.store";
import { usePreferencesStore } from "../../../shared/stores/preferences.store";
import { useScaleStore } from "../../../shared/stores/scale.store";
import type { CommandOption } from "../../../shared/ui";
import { getShortcutForCommand } from "../../../shared/utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

const SCALE_STEP = 0.1;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.0;

export function registerApplicationCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const { onNavigate, handleClose, onToggleSidebar, onShowHelp, resetLayout, notification } = ctx;
	const commands: CommandOption[] = [
		{
			id: "open-quick-capture",
			icon: <PenLine className="text-lg" />,
			text: "Quick Capture",
			hint: "Quick note",
			group: "Application",
			keywords: ["quick", "capture", "note", "notebook", "entry"],
			action: () => {
				onNavigate("quick-capture");
				handleClose();
			},
		},
		{
			id: "open-finder",
			icon: <Search className="text-lg" />,
			text: "Open Finder",
			hint: "Search all documents",
			group: "Application",
			keywords: ["finder", "search", "global", "lookup"],
			action: () => {
				handleClose();
				useGlobalSearchStore.getState().open();
			},
		},
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
		{
			id: "rebuild-search-index",
			icon: <Search className="text-lg" />,
			text: "Rebuild Search Index",
			hint: "Reindex all documents",
			group: "Application",
			keywords: ["rebuild", "reindex", "search", "index"],
			action: async () => {
				handleClose();
				// build() handles its own errors and reports outcome via store status
				// rather than throwing, so inspect status instead of catching.
				await useSearchIndexStore.getState().build();
				if (useSearchIndexStore.getState().status === "error") {
					notification.error("Failed to rebuild search index");
				} else {
					notification.success("Search index rebuilt");
				}
			},
		},
		{
			id: "toggle-theme",
			icon: <Moon className="text-lg" />,
			text: "Toggle Theme",
			hint: "Cycle dark / light / system",
			group: "Application",
			keywords: ["theme", "dark", "light", "system", "appearance"],
			action: async () => {
				const current = usePreferencesStore.getState().overrides?.appearance?.theme ?? "dark";
				const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
				try {
					await usePreferencesStore.getState().saveOverrides({
						...usePreferencesStore.getState().overrides,
						appearance: { ...usePreferencesStore.getState().overrides?.appearance, theme: next },
					});
					notification.info(`Theme: ${next}`);
				} catch {
					notification.error("Failed to change theme");
				}
			},
		},
		{
			id: "zoom-in",
			icon: <ZoomIn className="text-lg" />,
			text: "Zoom In",
			hint: "Increase scale",
			group: "Application",
			keywords: ["zoom", "scale", "bigger", "larger"],
			action: () => {
				const current = useScaleStore.getState().scale;
				const next = Math.min(SCALE_MAX, Math.round((current + SCALE_STEP) * 10) / 10);
				useScaleStore.getState().setScale(next);
			},
		},
		{
			id: "zoom-out",
			icon: <ZoomOut className="text-lg" />,
			text: "Zoom Out",
			hint: "Decrease scale",
			group: "Application",
			keywords: ["zoom", "scale", "smaller", "reduce"],
			action: () => {
				const current = useScaleStore.getState().scale;
				const next = Math.max(SCALE_MIN, Math.round((current - SCALE_STEP) * 10) / 10);
				useScaleStore.getState().setScale(next);
			},
		},
		{
			id: "zoom-reset",
			icon: <ArrowDown className="text-lg" />,
			text: "Reset Zoom",
			hint: "100% scale",
			group: "Application",
			keywords: ["zoom", "scale", "reset", "default"],
			action: () => {
				useScaleStore.getState().setScale(1.0);
			},
		},
	];

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
