import React, { useCallback, useMemo, lazy, Suspense } from "react";
import { BlockNoteBlock } from "../../types/Document";
import { Block, BlockNoteEditor } from "@blocknote/core";

const RichEditor = lazy(() =>
  import("../editor/RichEditor").then((m) => ({ default: m.RichEditor })),
);

const EditorLoader = () => <div className="h-full w-full" />;

interface DocumentEditorFormProps {
  blocks: BlockNoteBlock[];
  tags: string[];
  isEditMode: boolean;
  isLoading: boolean;
  isReadOnly?: boolean;
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: BlockNoteBlock[]) => void;
  onTagRemove: (tag: string) => void;
  onEditorReady?: (editor: BlockNoteEditor) => void;
}

export const DocumentEditorForm: React.FC<DocumentEditorFormProps> = ({
  blocks,
  tags,
  isEditMode,
  isLoading,
  isReadOnly = false,
  onTitleChange,
  onBlocksChange,
  onTagRemove,
  onEditorReady,
}) => {
  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, tag: string) => {
      if (isReadOnly) {
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onTagRemove(tag);
      }
    },
    [onTagRemove, isReadOnly],
  );

  const handleBlocksChange = useCallback(
    (newBlocks: Block[]) => {
      if (isReadOnly) {
        return;
      }
      onBlocksChange(newBlocks as BlockNoteBlock[]);
    },
    [onBlocksChange, isReadOnly],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (isReadOnly) {
        return;
      }
      onTitleChange(title);
    },
    [isReadOnly, onTitleChange],
  );

  const blocksJson = useMemo(
    () => (blocks.length > 0 ? JSON.stringify(blocks) : ""),
    [blocks],
  );

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden document-editor-form">
      <div className="flex-1 w-full px-2 overflow-hidden">
        <Suspense fallback={<EditorLoader />}>
          <RichEditor
            initialContent={blocksJson}
            docKey={
              isEditMode ? "edit:" + (blocksJson ? "loaded" : "pending") : "new"
            }
            onChange={handleBlocksChange}
            onTitleChange={handleTitleChange}
            onReady={onEditorReady}
            editable={!isLoading && !isReadOnly}
            isLoading={isLoading && isEditMode}
            className="h-full"
          />
        </Suspense>
      </div>
      {tags.length > 0 && (
        <div className="px-2 py-2">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                onKeyDown={(e) => handleTagKeyDown(e, tag)}
                onClick={() => {
                  if (!isReadOnly) onTagRemove(tag);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded bg-surface text-text-dim transition-colors hover:bg-accent hover:text-text focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isLoading || isReadOnly}
                title="Click or press Delete/Backspace to remove"
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-text-dim">
            Use :tag to add tags, or click/focus and press Delete to remove
          </div>
        </div>
      )}
    </div>
  );
};
