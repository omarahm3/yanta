import { useCallback, useRef } from "react";
import { BlockNoteEditor } from "@blocknote/core";

export const useDocumentEditor = () => {
  const editorRef = useRef<BlockNoteEditor | null>(null);

  const handleEditorReady = useCallback((editor: BlockNoteEditor) => {
    editorRef.current = editor;
    setTimeout(() => {
      editor.focus();
      const lastBlock = editor.document[editor.document.length - 1];
      if (lastBlock) {
        editor.setTextCursorPosition(lastBlock, "end");
      }
    }, 0);
  }, []);

  return {
    editorRef,
    handleEditorReady,
  };
};
