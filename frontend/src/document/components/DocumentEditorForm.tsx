import type { Block, BlockNoteEditor } from "@blocknote/core";
import React, { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { GranularErrorBoundary } from "@/app";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { Button } from "../../shared/ui";

const RichEditor = lazy(() =>
	import("../../editor/RichEditor").then((m) => ({ default: m.RichEditor })),
);

const EditorLoader = () => <div className="h-full w-full" />;

interface DocumentEditorFormProps {
	blocks: BlockNoteBlock[];
	tags: string[];
	isEditMode: boolean;
	isLoading: boolean;
	isReadOnly?: boolean;
	autoFocus?: boolean;
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
	autoFocus = true,
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

	const blocksJson = useMemo(() => (blocks.length > 0 ? JSON.stringify(blocks) : ""), [blocks]);
	const [editorKey, setEditorKey] = useState(0);

	return (
		<div className="document-editor-form flex flex-col min-h-full w-full">
			<div className="flex-1 min-h-0 w-full px-2 overflow-hidden">
				<GranularErrorBoundary
					key={editorKey}
					message="Something went wrong in the editor."
					onRetry={() => setEditorKey((k) => k + 1)}
				>
					<Suspense fallback={<EditorLoader />}>
						<RichEditor
							initialContent={blocksJson}
							docKey={isEditMode ? `edit:${blocksJson ? "loaded" : "pending"}` : "new"}
							onChange={handleBlocksChange}
							onTitleChange={handleTitleChange}
							onReady={onEditorReady}
							editable={!isLoading && !isReadOnly}
							isLoading={isLoading && isEditMode}
							autoFocus={autoFocus}
							className="h-full"
						/>
					</Suspense>
				</GranularErrorBoundary>
			</div>
			{tags.length > 0 && (
				<div className="px-2 py-2">
					<div className="flex flex-wrap gap-2">
						{tags.map((tag) => (
							<TagChip
								key={tag}
								tag={tag}
								isLoading={isLoading}
								isReadOnly={isReadOnly}
								onRemove={onTagRemove}
								onKeyDown={handleTagKeyDown}
							/>
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

interface TagChipProps {
	tag: string;
	isLoading: boolean;
	isReadOnly: boolean;
	onRemove: (tag: string) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, tag: string) => void;
}

const TagChip: React.FC<TagChipProps> = React.memo(
	({ tag, isLoading, isReadOnly, onRemove, onKeyDown }) => (
		<Button
			variant="secondary"
			size="sm"
			onKeyDown={(e) => onKeyDown(e, tag)}
			onClick={() => {
				if (!isReadOnly) onRemove(tag);
			}}
			className="inline-flex items-center gap-1 text-sm"
			disabled={isLoading || isReadOnly}
			title="Click or press Delete/Backspace to remove"
		>
			{tag}
		</Button>
	),
);
