import type { BlockNoteEditor } from "@blocknote/core";
import { type MutableRefObject, useCallback } from "react";

interface UseDocumentEscapeHandlingProps {
	editorRef: MutableRefObject<BlockNoteEditor | null>;
	onNavigateBack: () => void;
	/** When false (e.g. another pane is active), only blur; do not navigate back. Default true. */
	isActivePane?: boolean;
}

interface UseDocumentEscapeHandlingReturn {
	handleEscape: (e: KeyboardEvent) => void;
	handleUnfocus: (e: KeyboardEvent) => void;
}

function blurEditor(editor: BlockNoteEditor): boolean {
	try {
		if (!editor.isFocused()) return false;
		const domEditor = editor.domElement;
		if (domEditor) domEditor.blur();
		return true;
	} catch (err) {
		console.warn("[useDocumentEscapeHandling] blurEditor failed:", err);
		return false;
	}
}

export const useDocumentEscapeHandling = ({
	editorRef,
	onNavigateBack,
	isActivePane = true,
}: UseDocumentEscapeHandlingProps): UseDocumentEscapeHandlingReturn => {
	const handleEscape = useCallback(
		(e: KeyboardEvent) => {
			const editor = editorRef.current;
			if (!editor) {
				return;
			}

			if (blurEditor(editor)) {
				e.preventDefault();
				e.stopPropagation();
			} else if (isActivePane) {
				e.preventDefault();
				e.stopPropagation();
				onNavigateBack();
			}
		},
		[editorRef, onNavigateBack, isActivePane],
	);

	const handleUnfocus = useCallback(
		(e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();

			const editor = editorRef.current;
			if (editor) blurEditor(editor);
		},
		[editorRef],
	);

	return {
		handleEscape,
		handleUnfocus,
	};
};
