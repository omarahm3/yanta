import type { EditorHandle } from "../../editor/types";

/**
 * Returns the exact selected text from the editor via the ProseMirror view.
 *
 * Unlike `editor.getSelection()` (which is block-level and returns null for a
 * partial selection within a single block, or the *entire* text of every
 * touched block for multi-block selections), this returns only the characters
 * the user actually selected. Empty string when there is no selection.
 */
export function getSelectedText(editor: EditorHandle | null): string {
	const view = editor?.prosemirrorView;
	if (!view) return "";
	const { from, to, empty } = view.state.selection;
	if (empty) return "";
	return view.state.doc.textBetween(from, to, "\n");
}

/** Returns the full document text via the ProseMirror view (blocks joined by newlines). */
export function getDocumentText(editor: EditorHandle | null): string {
	const view = editor?.prosemirrorView;
	if (!view) return "";
	return view.state.doc.textBetween(0, view.state.doc.content.size, "\n");
}
