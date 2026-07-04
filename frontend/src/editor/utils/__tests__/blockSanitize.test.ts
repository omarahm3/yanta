import type { Block, PartialBlock } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import { UNKNOWN_BLOCK_TYPE, type UnknownBlockProps } from "../../extensions/unknownBlock/constants";
import { restoreUnknownBlocks, sanitizeUnknownBlocks } from "../blockSanitize";

const KNOWN = new Set(["heading", "paragraph", "bulletListItem", UNKNOWN_BLOCK_TYPE]);

describe("sanitizeUnknownBlocks", () => {
	it("passes known blocks through unchanged", () => {
		const blocks = [
			{ id: "1", type: "heading", props: { level: 1 }, content: [] },
			{ id: "2", type: "paragraph", props: {}, content: [] },
		] as unknown as PartialBlock[];

		expect(sanitizeUnknownBlocks(blocks, KNOWN)).toEqual(blocks);
	});

	it("wraps an unknown block type into a quarantine placeholder", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const bad = { id: "9", type: "customPluginBlock", props: { foo: "bar" }, content: [] };

		const [result] = sanitizeUnknownBlocks([bad] as unknown as PartialBlock[], KNOWN);

		expect(result.type).toBe(UNKNOWN_BLOCK_TYPE);
		const props = result.props as unknown as UnknownBlockProps;
		expect(props.originalType).toBe("customPluginBlock");
		expect(JSON.parse(props.originalJson)).toEqual(bad);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("quarantines unknown child blocks inside a known parent", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const parent = {
			id: "p",
			type: "bulletListItem",
			props: {},
			content: [],
			children: [{ id: "c", type: "weirdBlock", props: {}, content: [] }],
		};

		const [result] = sanitizeUnknownBlocks([parent] as unknown as PartialBlock[], KNOWN);

		expect(result.type).toBe("bulletListItem");
		expect(result.children?.[0].type).toBe(UNKNOWN_BLOCK_TYPE);
		vi.restoreAllMocks();
	});
});

describe("restoreUnknownBlocks", () => {
	it("round-trips an unknown block losslessly", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const original = { id: "9", type: "customPluginBlock", props: { foo: "bar" }, content: [], children: [] };

		const sanitized = sanitizeUnknownBlocks([original] as unknown as PartialBlock[], KNOWN);
		const restored = restoreUnknownBlocks(sanitized as unknown as Block[]);

		expect(restored).toEqual([original]);
		vi.restoreAllMocks();
	});

	it("round-trips a nested unknown child losslessly", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const parent = {
			id: "p",
			type: "bulletListItem",
			props: {},
			content: [],
			children: [{ id: "c", type: "weirdBlock", props: { x: 1 }, content: [], children: [] }],
		};

		const sanitized = sanitizeUnknownBlocks([parent] as unknown as PartialBlock[], KNOWN);
		const restored = restoreUnknownBlocks(sanitized as unknown as Block[]);

		expect(restored).toEqual([parent]);
		vi.restoreAllMocks();
	});

	it("throws when a quarantine block is missing its originalJson", () => {
		const broken = [
			{ id: "9", type: UNKNOWN_BLOCK_TYPE, props: { originalType: "x", originalJson: "" }, content: [] },
		] as unknown as Block[];

		expect(() => restoreUnknownBlocks(broken)).toThrow(/originalJson/);
	});
});
