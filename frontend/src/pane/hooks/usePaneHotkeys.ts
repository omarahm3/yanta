import { useMemo } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { useHotkeys } from "../../hotkeys";
import { useNotification } from "../../shared/hooks";
import type { HotkeyConfig } from "../../shared/types/hotkeys";
import { MAX_PANES } from "../types";
import { countLeaves, getPaneInDirection, type PaneDirection } from "../utils/paneLayoutUtils";
import { usePaneLayout } from "./usePaneLayout";

export const usePaneHotkeys = (): void => {
	const { layout, activePaneId, splitPane, closePane, setActivePane } = usePaneLayout();
	const { shortcuts } = useMergedConfig();
	const { warning } = useNotification();
	const pane = shortcuts.pane;

	const directionKeys: { key: string; direction: PaneDirection }[] = useMemo(
		() => [
			{ key: pane.focusLeft.key, direction: "left" },
			{ key: pane.focusDown.key, direction: "down" },
			{ key: pane.focusUp.key, direction: "up" },
			{ key: pane.focusRight.key, direction: "right" },
		],
		[pane],
	);

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				...pane.splitRight,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const leafCount = countLeaves(layout.root);
					if (leafCount >= MAX_PANES) {
						warning(`Maximum ${MAX_PANES} panes`);
						return;
					}
					splitPane(activePaneId, "horizontal");
				},
				allowInInput: true,
				capture: true,
				category: "Panes",
			},
			{
				...pane.splitDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					const leafCount = countLeaves(layout.root);
					if (leafCount >= MAX_PANES) {
						warning(`Maximum ${MAX_PANES} panes`);
						return;
					}
					splitPane(activePaneId, "vertical");
				},
				allowInInput: true,
				capture: true,
				category: "Panes",
			},
			{
				...pane.close,
				handler: (event: KeyboardEvent) => {
					const leafCount = countLeaves(layout.root);
					if (leafCount <= 1) {
						warning("Cannot close the last pane");
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
		[layout.root, activePaneId, splitPane, closePane, setActivePane, pane, directionKeys],
	);

	useHotkeys(hotkeys);
};
