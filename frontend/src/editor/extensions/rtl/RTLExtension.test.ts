import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { createRTLPlugin } from "./RTLExtension";

// Minimal schema with a block node carrying a `dir` attribute, mirroring how the
// real editor puts `dir` on `blockContainer`.
const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		block: {
			group: "block",
			content: "inline*",
			attrs: { dir: { default: null } },
			toDOM: () => ["p", 0],
			parseDOM: [{ tag: "p" }],
		},
		text: { group: "inline" },
	},
});

function stateWith(blocks: Array<{ text: string; dir?: string | null }>): EditorState {
	const nodes = blocks.map(({ text, dir = null }) =>
		schema.nodes.block.create({ dir }, text ? schema.text(text) : null),
	);
	const doc = schema.nodes.doc.create(null, nodes);
	return EditorState.create({ schema, plugins: [createRTLPlugin()], doc });
}

describe("createRTLPlugin appendTransaction (range-limited)", () => {
	it("sets dir on the edited block without touching other blocks", () => {
		let state = stateWith([
			{ text: "مرحبا", dir: "rtl" },
			{ text: "", dir: null },
		]);

		const posInSecond = state.doc.child(0).nodeSize + 1;
		state = state.apply(state.tr.insertText("hello", posInSecond));

		// Edited block gets its detected direction...
		expect(state.doc.child(1).attrs.dir).toBe("ltr");
		// ...and the untouched block keeps its existing direction (range-limited scan).
		expect(state.doc.child(0).attrs.dir).toBe("rtl");
	});

	it("updates a block's dir when its own content direction flips", () => {
		let state = stateWith([{ text: "hello", dir: "ltr" }]);

		const to = state.doc.child(0).content.size + 1;
		state = state.apply(state.tr.insertText("مرحبا", 1, to));

		expect(state.doc.child(0).attrs.dir).toBe("rtl");
	});

	it("clears dir when a block is emptied", () => {
		let state = stateWith([{ text: "مرحبا", dir: "rtl" }]);

		const to = state.doc.child(0).content.size + 1;
		state = state.apply(state.tr.delete(1, to));

		expect(state.doc.child(0).attrs.dir).toBeNull();
	});

	it("leaves the document unchanged when an edit does not change any direction", () => {
		const state = stateWith([{ text: "hello", dir: "ltr" }]);
		const next = state.apply(state.tr.insertText(" world", state.doc.child(0).content.size + 1));

		expect(next.doc.child(0).attrs.dir).toBe("ltr");
	});
});
