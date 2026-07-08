import { Schema } from "@tiptap/pm/model";
import { type EditorState, EditorState as PMEditorState } from "prosemirror-state";
import { describe, expect, it } from "vitest";
import { createFindPlugin, type FindMeta, findPluginKey } from "./findPlugin";
import { applyReplaceAll, applyReplaceOne } from "./replace";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { group: "block", content: "inline*" },
		text: { group: "inline" },
	},
});

function makeState(text: string): EditorState {
	const doc = schema.node("doc", null, [
		schema.node("paragraph", null, text ? [schema.text(text)] : []),
	]);
	return PMEditorState.create({ doc, plugins: [createFindPlugin()] });
}

function setFind(state: EditorState, meta: FindMeta): EditorState {
	return state.apply(state.tr.setMeta(findPluginKey, meta));
}

function getFind(state: EditorState) {
	const s = findPluginKey.getState(state);
	if (!s) throw new Error("find plugin state missing");
	return s;
}

describe("find replace", () => {
	it("replaceAll swaps every match and the plugin re-finds none left", () => {
		let state = setFind(makeState("system and another system here"), { query: "system" });
		expect(getFind(state).matches).toHaveLength(2);

		state = state.apply(applyReplaceAll(state.tr, getFind(state).matches, "module"));

		expect(state.doc.textContent).toBe("module and another module here");
		// The doc-changed re-find recomputes against the still-active query.
		expect(getFind(state).matches).toHaveLength(0);
	});

	it("replaceAll keeps positions valid when the replacement changes length", () => {
		// Replacement is longer than the match; reverse-order application must not
		// corrupt the earlier positions.
		let state = setFind(makeState("ab ab ab"), { query: "ab" });
		expect(getFind(state).matches).toHaveLength(3);

		state = state.apply(applyReplaceAll(state.tr, getFind(state).matches, "wxyz"));
		expect(state.doc.textContent).toBe("wxyz wxyz wxyz");
	});

	it("replaceAll with an empty replacement deletes every match", () => {
		let state = setFind(makeState("x-x-x"), { query: "x" });
		expect(getFind(state).matches).toHaveLength(3);

		state = state.apply(applyReplaceAll(state.tr, getFind(state).matches, ""));
		expect(state.doc.textContent).toBe("--");
	});

	it("applyReplaceOne replaces only the active match", () => {
		let state = setFind(makeState("system system system"), { query: "system" });
		const { matches, activeIndex } = getFind(state);
		expect(activeIndex).toBe(0);

		state = state.apply(applyReplaceOne(state.tr, matches[activeIndex], "module"));

		expect(state.doc.textContent).toBe("module system system");
		// One replaced, two remain after the re-find.
		expect(getFind(state).matches).toHaveLength(2);
	});
});
