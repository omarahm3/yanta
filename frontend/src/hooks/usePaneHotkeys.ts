import { useMemo } from "react";
import type { HotkeyConfig } from "../types/hotkeys";
import { type PaneDirection, countLeaves, getPaneInDirection } from "../utils/paneLayoutUtils";
import { useHotkeys } from "./useHotkey";
import { usePaneLayout } from "./usePaneLayout";

const directionKeys: { key: string; direction: PaneDirection }[] = [
	{ key: "alt+h", direction: "left" },
	{ key: "alt+j", direction: "down" },
	{ key: "alt+k", direction: "up" },
	{ key: "alt+l", direction: "right" },
];

/**
 * Registers keyboard shortcuts for pane management.
 * Only call this hook from the document page (PaneLayoutView).
 *
 * Shortcuts:
 * - Ctrl+\  : Split active pane horizontally (right)
 * - Ctrl+Shift+\  : Split active pane vertically (down)
 * - Alt+X : Close active pane (when multiple panes exist)
 * - Alt+H/J/K/L : Vim-style focus pane (left / down / up / right)
 */
export const usePaneHotkeys = (): void => {
	const { layout, activePaneId, splitPane, closePane, setActivePane } = usePaneLayout();

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				key: "mod+\\",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					splitPane(activePaneId, "horizontal");
				},
				allowInInput: true,
				capture: true,
				description: "Split pane right",
				category: "Panes",
			},
			{
				key: "mod+shift+\\",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					splitPane(activePaneId, "vertical");
				},
				allowInInput: true,
				capture: true,
				description: "Split pane down",
				category: "Panes",
			},
			{
				key: "alt+x",
				handler: (event: KeyboardEvent) => {
					const leafCount = countLeaves(layout.root);
					if (leafCount <= 1) {
						return;
					}
					event.preventDefault();
					closePane(activePaneId);
				},
				allowInInput: true,
				capture: true,
				description: "Close active pane",
				category: "Panes",
			},
			...directionKeys.map(({ key, direction }) => ({
				key,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const id = getPaneInDirection(layout.root, activePaneId, direction);
					if (id) setActivePane(id);
				},
				allowInInput: true,
				capture: true,
				description: `Focus pane ${direction}`,
				category: "Panes",
			})),
		],
		[layout.root, activePaneId, splitPane, closePane, setActivePane],
	);

	useHotkeys(hotkeys);
};
