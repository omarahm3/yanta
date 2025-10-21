import { useCallback, MutableRefObject } from "react";
import { BlockNoteEditor } from "@blocknote/core";

interface UseDocumentEscapeHandlingProps {
  editorRef: MutableRefObject<BlockNoteEditor | null>;
  onNavigateBack: () => void;
}

interface UseDocumentEscapeHandlingReturn {
  handleEscape: (e: KeyboardEvent) => void;
  handleUnfocus: (e: KeyboardEvent) => void;
}

export const useDocumentEscapeHandling = ({
  editorRef,
  onNavigateBack,
}: UseDocumentEscapeHandlingProps): UseDocumentEscapeHandlingReturn => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (!editor.isFocused()) {
        e.preventDefault();
        e.stopPropagation();
        onNavigateBack();
      }
    },
    [editorRef, onNavigateBack],
  );

  const handleUnfocus = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (editor.isFocused()) {
        const domEditor = editor.domElement;
        if (domEditor) {
          domEditor.blur();
        }
      }
    },
    [editorRef],
  );

  return {
    handleEscape,
    handleUnfocus,
  };
};
