import type { PaneNode, PaneSplit, ScrollPosition, SplitDirection } from "../types";
import { MAX_PANES } from "../types";
import { generatePaneId } from "./paneId";
import { countLeaves, findPane } from "./paneTreeQueries";

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
			] as [PaneNode, PaneNode],
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

	if (first.type === "leaf" && first.id === paneId) {
		return second;
	}
	if (second.type === "leaf" && second.id === paneId) {
		return first;
	}

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
