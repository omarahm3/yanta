import { describe, expect, it } from "vitest";
import type { PaneLeaf, PaneNode, PaneSplit } from "../types";
import {
	countLeaves,
	findPane,
	getLeaves,
	getNextLeafId,
	getPaneInDirection,
	getPreviousLeafId,
	validateLayout,
} from "../utils/paneLayoutUtils";

const leaf = (id: string, documentPath: string | null = null): PaneLeaf => ({
	type: "leaf",
	id,
	documentPath,
});

const split = (
	id: string,
	direction: "horizontal" | "vertical",
	children: [PaneNode, PaneNode],
): PaneSplit => ({
	type: "split",
	id,
	direction,
	children,
	sizes: [50, 50],
});

describe("paneLayoutUtils", () => {
	describe("countLeaves", () => {
		it("returns 1 for a single leaf", () => {
			expect(countLeaves(leaf("p1"))).toBe(1);
		});

		it("returns 2 for a split with two leaves", () => {
			expect(countLeaves(split("s1", "horizontal", [leaf("p1"), leaf("p2")]))).toBe(2);
		});

		it("returns correct count for nested splits", () => {
			const tree = split("s1", "horizontal", [
				leaf("p1"),
				split("s2", "vertical", [leaf("p2"), leaf("p3")]),
			]);
			expect(countLeaves(tree)).toBe(3);
		});
	});

	describe("findPane", () => {
		it("finds a root leaf", () => {
			const node = leaf("p1");
			expect(findPane(node, "p1")).toBe(node);
		});

		it("finds a leaf inside a split", () => {
			const p2 = leaf("p2");
			const tree = split("s1", "horizontal", [leaf("p1"), p2]);
			expect(findPane(tree, "p2")).toBe(p2);
		});

		it("returns null for non-existent ID", () => {
			const tree = split("s1", "horizontal", [leaf("p1"), leaf("p2")]);
			expect(findPane(tree, "p99")).toBeNull();
		});
	});

	describe("getLeaves", () => {
		it("returns single leaf in array", () => {
			const leaves = getLeaves(leaf("p1", "doc"));
			expect(leaves).toHaveLength(1);
			expect(leaves[0].id).toBe("p1");
		});

		it("returns leaves in left-to-right order", () => {
			const tree = split("s1", "horizontal", [
				leaf("left"),
				split("s2", "vertical", [leaf("top"), leaf("bottom")]),
			]);
			const ids = getLeaves(tree).map((l) => l.id);
			expect(ids).toEqual(["left", "top", "bottom"]);
		});
	});

	describe("getNextLeafId / getPreviousLeafId", () => {
		const tree = split("s1", "horizontal", [
			leaf("p1"),
			split("s2", "vertical", [leaf("p2"), leaf("p3")]),
		]);

		it("wraps around from last to first", () => {
			expect(getNextLeafId(tree, "p3")).toBe("p1");
		});

		it("goes forward correctly", () => {
			expect(getNextLeafId(tree, "p1")).toBe("p2");
		});

		it("wraps around backwards", () => {
			expect(getPreviousLeafId(tree, "p1")).toBe("p3");
		});

		it("returns null for single leaf", () => {
			expect(getNextLeafId(leaf("p1"), "p1")).toBeNull();
		});
	});

	describe("getPaneInDirection", () => {
		const tree = split("s1", "horizontal", [leaf("left"), leaf("right")]);

		it("returns right pane from left pane", () => {
			expect(getPaneInDirection(tree, "left", "right")).toBe("right");
		});

		it("returns left pane from right pane", () => {
			expect(getPaneInDirection(tree, "right", "left")).toBe("left");
		});

		it("returns null when no pane in direction", () => {
			expect(getPaneInDirection(tree, "left", "left")).toBeNull();
		});

		it("works with vertical splits", () => {
			const vTree = split("s1", "vertical", [leaf("top"), leaf("bottom")]);
			expect(getPaneInDirection(vTree, "top", "down")).toBe("bottom");
			expect(getPaneInDirection(vTree, "bottom", "up")).toBe("top");
		});
	});

	describe("validateLayout", () => {
		it("validates a correct layout", () => {
			expect(
				validateLayout({
					root: leaf("p1"),
					activePaneId: "p1",
					primaryDocumentPath: null,
				}),
			).toBe(true);
		});

		it("rejects null layout", () => {
			expect(validateLayout(null as any)).toBe(false);
		});

		it("rejects when activePaneId does not reference a leaf", () => {
			expect(
				validateLayout({
					root: leaf("p1"),
					activePaneId: "nonexistent",
					primaryDocumentPath: null,
				}),
			).toBe(false);
		});
	});
});
