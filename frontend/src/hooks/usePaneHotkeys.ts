import { useMemo } from "react";
import type { HotkeyConfig } from "../types/hotkeys";
import {
	countLeaves,
	getNextLeafId,
	getPaneInDirection,
	getPreviousLeafId,
} from "../utils/paneLayoutUtils";
import { useHotkeys } from "./useHotkey";
import { usePaneLayout } from "./usePaneLayout";

/**
 * Registers keyboard shortcuts for pane management.
 * Only call this hook from the document page (PaneLayoutView).
 *
 * Shortcuts:
 * - Ctrl+\  : Split active pane horizontally (right)
 * - Ctrl+Shift+\  : Split active pane vertically (down)
 * - Alt+X : Close active pane (when multiple panes exist)
 * - Ctrl+Alt+ArrowLeft : Navigate to previous pane
 * - Ctrl+Alt+ArrowRight : Navigate to next pane
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
			{
				key: "mod+alt+arrowleft",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const prevId = getPreviousLeafId(layout.root, activePaneId);
					if (prevId) {
						setActivePane(prevId);
					}
				},
				allowInInput: true,
				capture: true,
				description: "Focus previous pane",
				category: "Panes",
			},
			{
				key: "mod+alt+arrowright",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const nextId = getNextLeafId(layout.root, activePaneId);
					if (nextId) {
						setActivePane(nextId);
					}
				},
				allowInInput: true,
				capture: true,
				description: "Focus next pane",
				category: "Panes",
			},
			{
				key: "alt+h",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const id = getPaneInDirection(layout.root, activePaneId, "left");
					if (id) setActivePane(id);
				},
				allowInInput: true,
				capture: true,
				description: "Focus pane left",
				category: "Panes",
			},
			{
				key: "alt+j",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const id = getPaneInDirection(layout.root, activePaneId, "down");
					if (id) setActivePane(id);
				},
				allowInInput: true,
				capture: true,
				description: "Focus pane down",
				category: "Panes",
			},
			{
				key: "alt+k",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const id = getPaneInDirection(layout.root, activePaneId, "up");
					if (id) setActivePane(id);
				},
				allowInInput: true,
				capture: true,
				description: "Focus pane up",
				category: "Panes",
			},
			{
				key: "alt+l",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const id = getPaneInDirection(layout.root, activePaneId, "right");
					if (id) setActivePane(id);
				},
				allowInInput: true,
				capture: true,
				description: "Focus pane right",
				category: "Panes",
			},
		],
		[layout.root, activePaneId, splitPane, closePane, setActivePane],
	);

	useHotkeys(hotkeys);
};
