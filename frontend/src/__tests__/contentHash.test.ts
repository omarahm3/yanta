import { describe, expect, it } from "vitest";
import type { BlockNoteBlock } from "../shared/types/Document";
import { computeContentHash } from "../shared/utils/contentHash";

describe("computeContentHash", () => {
	it("should produce same hash for semantically identical blocks", () => {
		const blocks1 = [
			{
				id: "abc123",
				type: "paragraph",
				props: { textColor: "default" },
				content: [{ type: "text", text: "Hello", styles: {} }],
				children: [],
			},
		] as unknown as BlockNoteBlock[];

		const blocks2 = [
			{
				id: "xyz789",
				type: "paragraph",
				props: { textColor: "default" },
				content: [{ type: "text", text: "Hello", styles: {} }],
				children: [],
			},
		] as unknown as BlockNoteBlock[];

		expect(computeContentHash(blocks1)).toBe(computeContentHash(blocks2));
	});

	it("hashes sparse (on-disk) and hydrated blocks identically (P1.6)", () => {
		const sparse = [
			{ id: "a", type: "paragraph", content: [{ type: "text", text: "Hi", styles: {} }] },
		] as unknown as BlockNoteBlock[];
		const hydrated = [
			{
				id: "a",
				type: "paragraph",
				props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
				content: [{ type: "text", text: "Hi", styles: {} }],
				children: [],
			},
		] as unknown as BlockNoteBlock[];

		expect(computeContentHash(sparse)).toBe(computeContentHash(hydrated));
	});

	it("still distinguishes non-default prop values", () => {
		const red = [
			{ id: "a", type: "paragraph", props: { textColor: "red" }, content: [] },
		] as unknown as BlockNoteBlock[];
		const plain = [
			{ id: "a", type: "paragraph", props: { textColor: "default" }, content: [] },
		] as unknown as BlockNoteBlock[];

		expect(computeContentHash(red)).not.toBe(computeContentHash(plain));
	});

	it("should produce different hash for different content", () => {
		const blocks1 = [
			{
				id: "abc123",
				type: "paragraph",
				props: {},
				content: [{ type: "text", text: "Hello", styles: {} }],
				children: [],
			},
		] as unknown as BlockNoteBlock[];

		const blocks2 = [
			{
				id: "abc123",
				type: "paragraph",
				props: {},
				content: [{ type: "text", text: "World", styles: {} }],
				children: [],
			},
		] as unknown as BlockNoteBlock[];

		expect(computeContentHash(blocks1)).not.toBe(computeContentHash(blocks2));
	});

	it("should handle empty blocks array", () => {
		expect(() => computeContentHash([])).not.toThrow();
		expect(computeContentHash([])).toBe("[]");
	});

	it("should handle nested children", () => {
		const blocks = [
			{
				id: "parent",
				type: "bulletListItem",
				props: {},
				content: [{ type: "text", text: "Parent", styles: {} }],
				children: [
					{
						id: "child",
						type: "bulletListItem",
						props: {},
						content: [{ type: "text", text: "Child", styles: {} }],
						children: [],
					},
				],
			},
		] as unknown as BlockNoteBlock[];

		const hash = computeContentHash(blocks);
		expect(hash).toContain("Parent");
		expect(hash).toContain("Child");
		expect(hash).not.toContain('"id"');
	});

	it("should produce same hash when only IDs differ in nested blocks", () => {
		const blocks1 = [
			{
				id: "parent1",
				type: "bulletListItem",
				props: {},
				content: [{ type: "text", text: "Item", styles: {} }],
				children: [
					{
						id: "child1",
						type: "bulletListItem",
						props: {},
						content: [{ type: "text", text: "Nested", styles: {} }],
						children: [],
					},
				],
			},
		] as unknown as BlockNoteBlock[];

		const blocks2 = [
			{
				id: "parent999",
				type: "bulletListItem",
				props: {},
				content: [{ type: "text", text: "Item", styles: {} }],
				children: [
					{
						id: "child999",
						type: "bulletListItem",
						props: {},
						content: [{ type: "text", text: "Nested", styles: {} }],
						children: [],
					},
				],
			},
		] as unknown as BlockNoteBlock[];

		expect(computeContentHash(blocks1)).toBe(computeContentHash(blocks2));
	});
});
