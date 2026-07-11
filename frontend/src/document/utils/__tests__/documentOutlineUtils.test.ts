import { describe, expect, it } from "vitest";
import { extractHeadings, type HeadingItem } from "../documentOutlineUtils";
import type { BlockNoteBlock } from "../../shared/types/Document";

describe("extractHeadings", () => {
	it("returns empty array for empty blocks", () => {
		expect(extractHeadings([])).toEqual([]);
	});

	it("extracts H1 headings", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 1 },
				content: [{ type: "text", text: "Introduction" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "1", level: 1, text: "Introduction" }]);
	});

	it("extracts H2 headings", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 2 },
				content: [{ type: "text", text: "Section" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "1", level: 2, text: "Section" }]);
	});

	it("extracts H3 headings", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 3 },
				content: [{ type: "text", text: "Subsection" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "1", level: 3, text: "Subsection" }]);
	});

	it("ignores H4 and lower", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 4 },
				content: [{ type: "text", text: "H4" }],
			},
			{
				id: "2",
				type: "heading",
				props: { level: 1 },
				content: [{ type: "text", text: "H1" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "2", level: 1, text: "H1" }]);
	});

	it("extracts multiple headings in order", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 1 },
				content: [{ type: "text", text: "Title" }],
			},
			{
				id: "2",
				type: "paragraph",
				content: [{ type: "text", text: "Some text" }],
			},
			{
				id: "3",
				type: "heading",
				props: { level: 2 },
				content: [{ type: "text", text: "Section 1" }],
			},
			{
				id: "4",
				type: "heading",
				props: { level: 2 },
				content: [{ type: "text", text: "Section 2" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([
			{ id: "1", level: 1, text: "Title" },
			{ id: "3", level: 2, text: "Section 1" },
			{ id: "4", level: 2, text: "Section 2" },
		]);
	});

	it("handles headings with multiple text segments", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 1 },
				content: [
					{ type: "text", text: "Hello " },
					{ type: "text", text: "World" },
				],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "1", level: 1, text: "Hello World" }]);
	});

	it("handles headings with no content", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "heading",
				props: { level: 1 },
				content: [],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([{ id: "1", level: 1, text: "" }]);
	});

	it("ignores non-heading blocks", () => {
		const blocks: BlockNoteBlock[] = [
			{
				id: "1",
				type: "paragraph",
				content: [{ type: "text", text: "Not a heading" }],
			},
		];
		const headings = extractHeadings(blocks);
		expect(headings).toEqual([]);
	});
});
