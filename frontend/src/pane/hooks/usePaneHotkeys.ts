import { useMemo } from "react";
import { PANE_SHORTCUTS } from "../../config";
import { useHotkeys } from "../../hooks";
import type { HotkeyConfig } from "../../types/hotkeys";
import { countLeaves, getPaneInDirection, type PaneDirection } from "../utils/paneLayoutUtils";
import { usePaneLayout } from "./usePaneLayout";

const directionKeys: { key: string; direction: PaneDirection }[] = [
	{ key: PANE_SHORTCUTS.focusLeft.key, direction: "left" },
	{ key: PANE_SHORTCUTS.focusDown.key, direction: "down" },
	{ key: PANE_SHORTCUTS.focusUp.key, direction: "up" },
	{ key: PANE_SHORTCUTS.focusRight.key, direction: "right" },
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
				...PANE_SHORTCUTS.splitRight,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					splitPane(activePaneId, "horizontal");
				},
				allowInInput: true,
				capture: true,
				category: "Panes",
			},
			{
				...PANE_SHORTCUTS.splitDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					splitPane(activePaneId, "vertical");
				},
				allowInInput: true,
				capture: true,
				category: "Panes",
			},
			{
				...PANE_SHORTCUTS.close,
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
