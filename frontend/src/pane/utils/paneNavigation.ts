import type { PaneNode } from "../types";
import { getLeaves, getPathToLeaf } from "./paneTreeQueries";

/**
 * Get the next leaf ID in left-to-right order, wrapping around.
 */
export function getNextLeafId(root: PaneNode, currentId: string): string | null {
	const leaves = getLeaves(root);
	if (leaves.length <= 1) return null;

	const currentIndex = leaves.findIndex((leaf) => leaf.id === currentId);
	if (currentIndex === -1) return leaves[0].id;

	const nextIndex = (currentIndex + 1) % leaves.length;
	return leaves[nextIndex].id;
}

/**
 * Get the previous leaf ID in left-to-right order, wrapping around.
 */
export function getPreviousLeafId(root: PaneNode, currentId: string): string | null {
	const leaves = getLeaves(root);
	if (leaves.length <= 1) return null;

	const currentIndex = leaves.findIndex((leaf) => leaf.id === currentId);
	if (currentIndex === -1) return leaves[0].id;

	const prevIndex = (currentIndex - 1 + leaves.length) % leaves.length;
	return leaves[prevIndex].id;
}

export type PaneDirection = "left" | "right" | "up" | "down";

/**
 * Get the pane ID in the given spatial direction from the current pane (vim-style).
 * Returns null if there is no pane in that direction.
 */
export function getPaneInDirection(
	root: PaneNode,
	currentPaneId: string,
	direction: PaneDirection,
): string | null {
	const path = getPathToLeaf(root, currentPaneId);
	if (!path || path.length === 0) return null;

	if (direction === "left") {
		const step = path.find((s) => s.split.direction === "horizontal" && s.childIndex === 1);
		if (!step) return null;
		const leftSubtree = step.split.children[0];
		const leaves = getLeaves(leftSubtree);
		return leaves.at(-1)?.id ?? null;
	}
	if (direction === "right") {
		const step = path.find((s) => s.split.direction === "horizontal" && s.childIndex === 0);
		if (!step) return null;
		const rightSubtree = step.split.children[1];
		const leaves = getLeaves(rightSubtree);
		return leaves[0]?.id ?? null;
	}
	if (direction === "up") {
		const step = path.find((s) => s.split.direction === "vertical" && s.childIndex === 1);
		if (!step) return null;
		const topSubtree = step.split.children[0];
		const leaves = getLeaves(topSubtree);
		return leaves.at(-1)?.id ?? null;
	}
	if (direction === "down") {
		const step = path.find((s) => s.split.direction === "vertical" && s.childIndex === 0);
		if (!step) return null;
		const bottomSubtree = step.split.children[1];
		const leaves = getLeaves(bottomSubtree);
		return leaves[0]?.id ?? null;
	}
	return null;
}
