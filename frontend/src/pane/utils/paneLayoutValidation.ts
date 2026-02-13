import type { PaneLayoutState, PaneNode } from "../types";
import { createDefaultPaneLayout, MAX_PANES } from "../types";
import { findPane, getLeaves } from "./paneTreeQueries";

function validateNode(node: PaneNode): boolean {
	if (!node || !node.type || !node.id) {
		return false;
	}

	if (node.type === "leaf") {
		return true;
	}

	if (node.type === "split") {
		if (!node.direction || !node.children || node.children.length !== 2) {
			return false;
		}
		if (
			!node.sizes ||
			node.sizes.length !== 2 ||
			typeof node.sizes[0] !== "number" ||
			typeof node.sizes[1] !== "number"
		) {
			return false;
		}
		return validateNode(node.children[0]) && validateNode(node.children[1]);
	}

	return false;
}

/**
 * Validate that a pane layout tree has proper structure.
 * Returns true if valid, false otherwise.
 */
export function validateLayout(state: PaneLayoutState): boolean {
	if (!state || !state.root || !state.activePaneId) {
		return false;
	}

	if (!validateNode(state.root)) {
		return false;
	}

	const leaves = getLeaves(state.root);
	if (leaves.length === 0 || leaves.length > MAX_PANES) {
		return false;
	}

	const activeLeaf = findPane(state.root, state.activePaneId);
	if (!activeLeaf || activeLeaf.type !== "leaf") {
		return false;
	}

	return true;
}

/**
 * Safely restore a layout from persisted data, falling back to default on invalid data.
 */
export function restoreLayout(data: unknown): PaneLayoutState {
	try {
		const state = data as PaneLayoutState;
		if (validateLayout(state)) {
			return state;
		}
	} catch {
		// Invalid data - fall through to default
	}
	return createDefaultPaneLayout();
}
