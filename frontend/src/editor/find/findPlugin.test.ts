import { Schema } from "@tiptap/pm/model";
import { type EditorState, EditorState as PMEditorState } from "prosemirror-state";
import { describe, expect, it } from "vitest";
import { createFindPlugin, type FindMeta, findPluginKey } from "./findPlugin";

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

describe("find plugin", () => {
	it("highlights all matches with the active index at the first", () => {
		const state = setFind(makeState("a system and another system here"), { query: "system" });
		const fs = getFind(state);
		expect(fs.matches).toHaveLength(2);
		expect(fs.activeIndex).toBe(0);
		expect(fs.decorations.find()).toHaveLength(2);
	});

	it("navigates with wrap-around in both directions", () => {
		let state = setFind(makeState("x y x y x"), { query: "x" }); // 3 matches
		expect(getFind(state).activeIndex).toBe(0);
		state = setFind(state, { activeIndex: 1 });
		expect(getFind(state).activeIndex).toBe(1);
		state = setFind(state, { activeIndex: 3 }); // past the end → wraps to 0
		expect(getFind(state).activeIndex).toBe(0);
		state = setFind(state, { activeIndex: -1 }); // before the start → wraps to last
		expect(getFind(state).activeIndex).toBe(2);
	});

	it("clears highlights when the query is emptied", () => {
		let state = setFind(makeState("hello hello"), { query: "hello" });
		expect(getFind(state).matches).toHaveLength(2);
		state = setFind(state, { query: "" });
		expect(getFind(state).matches).toHaveLength(0);
		expect(getFind(state).decorations.find()).toHaveLength(0);
	});

	it("honors case sensitivity", () => {
		let state = setFind(makeState("Cat cat CAT"), { query: "cat", caseSensitive: false });
		expect(getFind(state).matches).toHaveLength(3);
		state = setFind(state, { query: "cat", caseSensitive: true });
		expect(getFind(state).matches).toHaveLength(1);
	});
});
