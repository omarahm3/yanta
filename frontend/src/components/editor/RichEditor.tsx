import React, { useEffect } from "react";
import { BlockNoteEditor, Block, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import "../../styles/blocknote-dark.css";
import { cn } from "../../lib/utils";
import { BlockNoteBlock } from "../../types/Document";
import { extractTitleFromBlocks } from "../../utils/documentUtils";

export interface RichEditorProps {
  initialContent?: string;
  onChange?: (blocks: Block[]) => void;
  onTitleChange?: (title: string) => void;
  onReady?: (editor: BlockNoteEditor) => void;
  className?: string;
  editable?: boolean;
  isLoading?: boolean;
  docKey?: string;
}

const createDefaultInitialBlock = (): PartialBlock => ({
  type: "heading",
  props: { level: 1 },
  content: [
    {
      type: "text",
      text: "",
      styles: {},
    },
  ],
});

type EditorInnerProps = {
  blocks: PartialBlock[];
  onChange?: (blocks: Block[]) => void;
  onTitleChange?: (title: string) => void;
  onReady?: (editor: BlockNoteEditor) => void;
  className?: string;
  editable: boolean;
};

const EditorInner: React.FC<EditorInnerProps> = ({
  blocks,
  onChange,
  onTitleChange,
  onReady,
  className,
  editable,
}) => {
  const editor = useCreateBlockNote({ initialContent: blocks });
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        setIsReady(true);
        if (onReady) onReady(editor);
      }, 50);
    }
  }, [editor, onReady]);

  useEffect(() => {
    if (editor && editable && isReady) {
      setTimeout(() => {
        editor.focus();
      }, 0);
    }
  }, [editor, editable, isReady]);

  useEffect(() => {
    if (!editor || !onChange) return;
    const unsubscribe = editor.onChange(() => {
      const currentBlocks = editor.document;
      onChange(currentBlocks);
      if (onTitleChange) {
        const title = extractTitleFromBlocks(currentBlocks as BlockNoteBlock[]);
        onTitleChange(title);
      }
    });
    return unsubscribe;
  }, [editor, onChange, onTitleChange]);

  useEffect(() => {
    if (editor) editor.isEditable = editable;
  }, [editor, editable]);

  if (!editor || !isReady) {
    return <div className={cn("h-full w-full", className)} />;
  }

  return (
    <div className={cn("rich-editor flex-1 overflow-y-auto h-full", className)}>
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  );
};

export const RichEditor: React.FC<RichEditorProps> = ({
  initialContent,
  onChange,
  onTitleChange,
  onReady,
  className,
  editable = true,
  isLoading = false,
  docKey,
}) => {
  const parsed = React.useMemo(() => {
    if (isLoading)
      return { ready: false as const, blocks: [] as PartialBlock[] };
    if (!initialContent || initialContent.trim() === "") {
      return { ready: true as const, blocks: [createDefaultInitialBlock()] };
    }
    try {
      const parsed = JSON.parse(initialContent);
      const blocks: PartialBlock[] = Array.isArray(parsed)
        ? (parsed as PartialBlock[])
        : [];
      if (
        blocks.length === 0 ||
        blocks[0].type !== "heading" ||
        blocks[0].props?.level !== 1
      ) {
        return {
          ready: true as const,
          blocks: [createDefaultInitialBlock(), ...blocks],
        };
      }
      return { ready: true as const, blocks };
    } catch (e) {
      console.error("Failed to parse initial content:", e);
      return { ready: true as const, blocks: [createDefaultInitialBlock()] };
    }
  }, [initialContent, isLoading]);

  if (!parsed.ready) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-text-dim">Loading document...</div>
      </div>
    );
  }

  const contentKey =
    docKey ??
    (initialContent && initialContent.trim() !== ""
      ? "__content__"
      : "__empty__");

  return (
    <EditorInner
      key={contentKey}
      blocks={parsed.blocks}
      onChange={onChange}
      onTitleChange={onTitleChange}
      onReady={onReady}
      className={className}
      editable={editable}
    />
  );
};
