import { codeBlockOptions } from "@blocknote/code-block";
import { BlockNoteEditor, BlockNoteSchema, createCodeBlockSpec, type PartialBlock } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import { UNKNOWN_BLOCK_TYPE, unknownBlockSpec } from "../extensions/unknownBlock";
import { restoreUnknownBlocks, sanitizeUnknownBlocks } from "../utils/blockSanitize";

function buildSchema() {
	return BlockNoteSchema.create().extend({
		blockSpecs: {
			codeBlock: createCodeBlockSpec(codeBlockOptions),
			[UNKNOWN_BLOCK_TYPE]: unknownBlockSpec,
		},
	});
}

const bogusDoc = [
	{ type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Title", styles: {} }] },
	{ type: "customPluginBlock", props: { foo: "bar" }, content: [{ type: "text", text: "hi", styles: {} }] },
] as unknown as PartialBlock[];

describe("unknown block crash prevention (integration)", () => {
	it("reproduces the crash: a raw unknown block type throws at editor creation", () => {
		const schema = buildSchema();
		expect(() => BlockNoteEditor.create({ schema, initialContent: bogusDoc })).toThrow();
	});

	it("does not crash when blocks are sanitized first, and round-trips losslessly", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const schema = buildSchema();
		const known = new Set(Object.keys(schema.blockSpecs));

		const safe = sanitizeUnknownBlocks(bogusDoc, known);
		const editor = BlockNoteEditor.create({ schema, initialContent: safe });

		const types = editor.document.map((b) => b.type);
		expect(types).toContain(UNKNOWN_BLOCK_TYPE);

		const restored = restoreUnknownBlocks(editor.document);
		expect(restored.some((b) => b.type === "customPluginBlock")).toBe(true);
		vi.restoreAllMocks();
	});
});
