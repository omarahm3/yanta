import type { BlockNoteEditor } from "@blocknote/core";
import { useCallback, useRef } from "react";

type TiptapInternal = { isDestroyed?: boolean };

/** Returns true only if the editor is mounted in the DOM and not destroyed. */
function isEditorReadyForCursorOp(editor: BlockNoteEditor): boolean {
	const dom = editor.domElement;
	if (!dom || !dom.isConnected) return false;
	const tiptap = (editor as BlockNoteEditor & { _tiptapEditor?: TiptapInternal })._tiptapEditor;
	if (tiptap?.isDestroyed) return false;
	return true;
}

export const useDocumentEditor = () => {
	const editorRef = useRef<BlockNoteEditor | null>(null);

	const handleEditorReady = useCallback((editor: BlockNoteEditor) => {
		// If a previous editor's RAF chain is still running, the editor ref
		// swap here makes `editorRef.current !== editor` for the stale chain,
		// which causes it to bail on its next tick.
		editorRef.current = editor;

		const tryFocus = (attempt: number) => {
			// Bail if this editor is no longer the active one (user switched
			// docs; the previous editor is being torn down).
			if (editorRef.current !== editor) return;
			// Bail if the editor was destroyed. Calling focus/setTextCursorPosition
			// on a destroyed editor triggers tiptap's `view['posAtDOM']` guard.
			if (!isEditorReadyForCursorOp(editor)) {
				if (attempt < 10 && editorRef.current === editor) {
					requestAnimationFrame(() => tryFocus(attempt + 1));
				}
				return;
			}

			try {
				editor.focus();
				const lastBlock = editor.document[editor.document.length - 1];
				if (lastBlock) {
					editor.setTextCursorPosition(lastBlock, "end");
				}
			} catch {
				// If the throw was a transient mount race, retry once — but
				// only while this editor is still active and not destroyed.
				if (attempt < 10 && editorRef.current === editor && isEditorReadyForCursorOp(editor)) {
					requestAnimationFrame(() => tryFocus(attempt + 1));
				}
			}
		};

		requestAnimationFrame(() => tryFocus(0));
	}, []);

	return {
		editorRef,
		handleEditorReady,
	};
};
