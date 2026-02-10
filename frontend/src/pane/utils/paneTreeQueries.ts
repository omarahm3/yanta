import type { PaneLeaf, PaneNode, PaneSplit } from "../types";

/**
 * Find a pane node by ID within the tree.
 * Returns the node if found, or null otherwise.
 */
export function findPane(root: PaneNode, id: string): PaneNode | null {
	if (root.id === id) {
		return root;
	}
	if (root.type === "split") {
		const left = findPane(root.children[0], id);
		if (left) return left;
		return findPane(root.children[1], id);
	}
	return null;
}

/**
 * Count the number of leaf nodes in the tree.
 */
export function countLeaves(root: PaneNode): number {
	if (root.type === "leaf") {
		return 1;
	}
	return countLeaves(root.children[0]) + countLeaves(root.children[1]);
}

/**
 * Get all leaf nodes in left-to-right depth-first order.
 */
export function getLeaves(root: PaneNode): PaneLeaf[] {
	if (root.type === "leaf") {
		return [root];
	}
	return [...getLeaves(root.children[0]), ...getLeaves(root.children[1])];
}

/**
 * Get all document paths from leaf nodes (excluding nulls).
 */
export function getLeafPaths(root: PaneNode): string[] {
	return getLeaves(root)
		.map((leaf) => leaf.documentPath)
		.filter((path): path is string => path !== null);
}

/** Path step from root to a leaf: which split and which child (0 = first, 1 = second) */
export interface PathStep {
	split: PaneSplit;
	childIndex: 0 | 1;
}

/**
 * Get the path from root to the leaf with the given id.
 * Each step is the split and which child (0 or 1) was taken.
 * Returns null if the leaf is not found.
 */
export function getPathToLeaf(root: PaneNode, leafId: string): PathStep[] | null {
	if (root.type === "leaf") {
		return root.id === leafId ? [] : null;
	}
	const path0 = getPathToLeaf(root.children[0], leafId);
	if (path0 !== null) return [{ split: root, childIndex: 0 }, ...path0];
	const path1 = getPathToLeaf(root.children[1], leafId);
	if (path1 !== null) return [{ split: root, childIndex: 1 }, ...path1];
	return null;
}
