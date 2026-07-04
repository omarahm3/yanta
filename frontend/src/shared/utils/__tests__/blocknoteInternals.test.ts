import { BlockNoteEditor } from "@blocknote/core";
import { ShadCNDefaultComponents } from "@blocknote/shadcn";
import { describe, expect, it } from "vitest";
import {
	getImageBlockAcceptList,
	getTiptapEditor,
	isEditorAlive,
	isEditorViewUnavailableError,
	setImageBlockAccept,
} from "../blocknoteInternals";

// These tests intentionally exercise BlockNote INTERNALS. They exist to fail
// loudly on a version bump that renames/reshapes an internal, instead of the
// app breaking silently at runtime. See bnote-stable.md P2.

describe("blocknoteInternals — Tiptap access (P2.1/P2.4)", () => {
	it("getTiptapEditor returns the private tiptap editor with the expected shape", () => {
		const editor = BlockNoteEditor.create();
		const tiptap = getTiptapEditor(editor);
		expect(tiptap).not.toBeNull();
		expect(typeof tiptap?.registerPlugin).toBe("function");
		expect(typeof tiptap?.unregisterPlugin).toBe("function");
		expect(typeof tiptap?.isDestroyed).toBe("boolean");
	});

	it("isEditorAlive is false for a never-mounted editor", () => {
		const editor = BlockNoteEditor.create();
		expect(isEditorAlive(editor)).toBe(false);
	});

	it("isEditorAlive tracks DOM connection and destroyed state (P3.3)", () => {
		const alive = { domElement: { isConnected: true }, _tiptapEditor: { isDestroyed: false } };
		const detached = { domElement: { isConnected: false }, _tiptapEditor: { isDestroyed: false } };
		const destroyed = { domElement: { isConnected: true }, _tiptapEditor: { isDestroyed: true } };
		const noDom = { _tiptapEditor: { isDestroyed: false } };

		expect(isEditorAlive(alive as unknown as BlockNoteEditor)).toBe(true);
		expect(isEditorAlive(detached as unknown as BlockNoteEditor)).toBe(false);
		expect(isEditorAlive(destroyed as unknown as BlockNoteEditor)).toBe(false);
		expect(isEditorAlive(noDom as unknown as BlockNoteEditor)).toBe(false);
	});

	it("isEditorViewUnavailableError matches only tiptap's mount error", () => {
		expect(isEditorViewUnavailableError(new Error("The editor view is not available"))).toBe(true);
		expect(isEditorViewUnavailableError(new Error("something else"))).toBe(false);
		expect(isEditorViewUnavailableError("not an error")).toBe(false);
	});
});

describe("blocknoteInternals — image block accept (P2.2)", () => {
	it("reads and forces the image block's fileBlockAccept via internal meta", () => {
		const editor = BlockNoteEditor.create();
		expect(setImageBlockAccept(editor, ["image/*"])).toBe(true);
		expect(getImageBlockAcceptList(editor)).toContain("image/*");
	});
});

describe("shadcn portalling shape (P2.3)", () => {
	it("keeps the nested component shape portalledShadCN depends on", () => {
		expect(ShadCNDefaultComponents.DropdownMenu.DropdownMenuContent).toBeDefined();
		expect(ShadCNDefaultComponents.DropdownMenu.DropdownMenuSubContent).toBeDefined();
		expect(ShadCNDefaultComponents.Popover.PopoverContent).toBeDefined();
	});
});
