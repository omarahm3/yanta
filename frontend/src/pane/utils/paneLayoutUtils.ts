import type {
	PaneLayoutState,
	PaneLeaf,
	PaneNode,
	PaneSplit,
	ScrollPosition,
	SplitDirection,
} from "../types";
import { createDefaultPaneLayout, MAX_PANES } from "../types";

let paneIdCounter = 0;

export function generatePaneId(): string {
	paneIdCounter += 1;
	return `pane-${Date.now()}-${paneIdCounter}`;
}

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

/**
 * Replace a leaf node with a split containing two children.
 * The original leaf's document stays in the first child.
 * Returns a new tree (immutable).
 */
export function splitPane(root: PaneNode, paneId: string, direction: SplitDirection): PaneNode {
	if (countLeaves(root) >= MAX_PANES) {
		return root;
	}

	return replaceNode(root, paneId, (leaf) => {
		if (leaf.type !== "leaf") return leaf;

		const newSplit: PaneSplit = {
			type: "split",
			id: generatePaneId(),
			direction,
			children: [
				{ ...leaf },
				{
					type: "leaf",
					id: generatePaneId(),
					documentPath: null,
				},
			],
			sizes: [50, 50],
		};
		return newSplit;
	});
}

/**
 * Remove a leaf node and collapse its parent split.
 * The sibling takes the parent's place.
 * Returns a new tree (immutable).
 */
export function closePane(root: PaneNode, paneId: string): PaneNode {
	if (root.type === "leaf") {
		return root;
	}

	return closePaneInNode(root, paneId) ?? root;
}

function closePaneInNode(node: PaneNode, paneId: string): PaneNode | null {
	if (node.type === "leaf") {
		return null;
	}

	const [first, second] = node.children;

	// Direct child is the target leaf - return the sibling
	if (first.type === "leaf" && first.id === paneId) {
		return second;
	}
	if (second.type === "leaf" && second.id === paneId) {
		return first;
	}

	// Recurse into children
	const newFirst = closePaneInNode(first, paneId);
	if (newFirst) {
		return {
			...node,
			children: [newFirst, second],
		};
	}

	const newSecond = closePaneInNode(second, paneId);
	if (newSecond) {
		return {
			...node,
			children: [first, newSecond],
		};
	}

	return null;
}

/**
 * Update the size ratios of a split node's children.
 * Returns a new tree (immutable).
 */
export function resizePane(root: PaneNode, splitId: string, sizes: [number, number]): PaneNode {
	return replaceNode(root, splitId, (node) => {
		if (node.type !== "split") return node;
		return { ...node, sizes };
	});
}

/**
 * Update the document path of a leaf node.
 * Returns a new tree (immutable).
 */
export function openDocumentInPane(
	root: PaneNode,
	paneId: string,
	documentPath: string | null,
): PaneNode {
	return replaceNode(root, paneId, (node) => {
		if (node.type !== "leaf") return node;
		return { ...node, documentPath };
	});
}

/**
 * Update the scroll position of a leaf node.
 * Returns a new tree (immutable).
 */
export function updateScrollPosition(
	root: PaneNode,
	paneId: string,
	scrollPosition: ScrollPosition,
): PaneNode {
	return replaceNode(root, paneId, (node) => {
		if (node.type !== "leaf") return node;
		return { ...node, scrollPosition };
	});
}

/**
 * Move a document from one pane to another.
 * The source pane becomes empty.
 * Returns a new tree (immutable).
 */
export function moveDocumentBetweenPanes(
	root: PaneNode,
	sourcePaneId: string,
	targetPaneId: string,
): PaneNode {
	const sourceLeaf = findPane(root, sourcePaneId);
	if (!sourceLeaf || sourceLeaf.type !== "leaf") return root;

	const documentPath = sourceLeaf.documentPath;
	let newRoot = openDocumentInPane(root, sourcePaneId, null);
	newRoot = openDocumentInPane(newRoot, targetPaneId, documentPath);
	return newRoot;
}

/**
 * Swap documents between two panes.
 * Returns a new tree (immutable).
 */
export function swapPaneDocuments(root: PaneNode, paneIdA: string, paneIdB: string): PaneNode {
	const leafA = findPane(root, paneIdA);
	const leafB = findPane(root, paneIdB);
	if (!leafA || leafA.type !== "leaf" || !leafB || leafB.type !== "leaf") {
		return root;
	}

	const pathA = leafA.documentPath;
	const pathB = leafB.documentPath;
	let newRoot = openDocumentInPane(root, paneIdA, pathB);
	newRoot = openDocumentInPane(newRoot, paneIdB, pathA);
	return newRoot;
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

	// Active pane must reference an existing leaf
	const activeLeaf = findPane(state.root, state.activePaneId);
	if (!activeLeaf || activeLeaf.type !== "leaf") {
		return false;
	}

	return true;
}

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

export type PaneDirection = "left" | "right" | "up" | "down";

/**
 * Get the pane ID in the given spatial direction from the current pane (vim-style).
 * - left: pane immediately to the left
 * - right: pane immediately to the right
 * - up: pane immediately above
 * - down: pane immediately below
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

// --- Internal helpers ---

/**
 * Replace a node by ID within the tree, applying a transform function.
 * Returns a new tree (immutable).
 */
function replaceNode(
	node: PaneNode,
	targetId: string,
	transform: (node: PaneNode) => PaneNode,
): PaneNode {
	if (node.id === targetId) {
		return transform(node);
	}

	if (node.type === "split") {
		const newFirst = replaceNode(node.children[0], targetId, transform);
		const newSecond = replaceNode(node.children[1], targetId, transform);

		if (newFirst !== node.children[0] || newSecond !== node.children[1]) {
			return {
				...node,
				children: [newFirst, newSecond],
			};
		}
	}

	return node;
}
