import { describe, it, expect } from "vitest";
import { computeContentHash } from "../utils/contentHash";
import type { Block } from "@blocknote/core";

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
		] as unknown as Block[];

		const blocks2 = [
			{
				id: "xyz789",
				type: "paragraph",
				props: { textColor: "default" },
				content: [{ type: "text", text: "Hello", styles: {} }],
				children: [],
			},
		] as unknown as Block[];

		expect(computeContentHash(blocks1)).toBe(computeContentHash(blocks2));
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
		] as unknown as Block[];

		const blocks2 = [
			{
				id: "abc123",
				type: "paragraph",
				props: {},
				content: [{ type: "text", text: "World", styles: {} }],
				children: [],
			},
		] as unknown as Block[];

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
		] as unknown as Block[];

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
		] as unknown as Block[];

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
		] as unknown as Block[];

		expect(computeContentHash(blocks1)).toBe(computeContentHash(blocks2));
	});
});
