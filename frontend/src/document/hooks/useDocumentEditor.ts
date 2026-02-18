import type { BlockNoteEditor } from "@blocknote/core";
import { useCallback, useRef } from "react";

export const useDocumentEditor = () => {
	const editorRef = useRef<BlockNoteEditor | null>(null);

	const handleEditorReady = useCallback((editor: BlockNoteEditor) => {
		editorRef.current = editor;

		const tryFocus = (attempt: number) => {
			try {
				const dom = editor.domElement;
				if (!dom || !dom.isConnected) {
					if (attempt < 10) {
						requestAnimationFrame(() => tryFocus(attempt + 1));
					}
					return;
				}

				editor.focus();
				const lastBlock = editor.document[editor.document.length - 1];
				if (lastBlock) {
					editor.setTextCursorPosition(lastBlock, "end");
				}
			} catch {
				if (attempt < 10) {
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
