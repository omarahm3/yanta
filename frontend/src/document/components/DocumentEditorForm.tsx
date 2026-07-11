import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GranularErrorBoundary } from "@/app";
import type { DocumentFindControls } from "../../editor/find";
import { RichEditor } from "../../editor/RichEditor";
import type { EditorHandle } from "../../editor/types";
import {
	disableExternalPluginsForEditorRecovery,
	getActiveExternalPluginIds,
	hasActiveExternalPlugins,
} from "../../plugins/registry";
import { useNotification } from "../../shared/hooks";
import type { NavigationState, PageName } from "../../shared/types/navigation";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { Button } from "../../shared/ui";
import { countWords, countChars } from "../utils/editorCountUtils";

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
	onEditorReady?: (editor: EditorHandle) => void;
	find?: DocumentFindControls;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onCountChange?: (counts: { wordCount: number; charCount: number; selectionCount?: number }) => void;
	findBarRef?: React.RefObject<{ setQuery: (q: string) => void; focusInput: () => void } | null>;
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
	find,
	onNavigate,
	onCountChange,
	findBarRef,
}) => {
	const [editorHandle, setEditorHandle] = useState<EditorHandle | null>(null);

	const handleEditorReady = useCallback(
		(editor: EditorHandle) => {
			setEditorHandle(editor);
			onEditorReady?.(editor);
		},
		[onEditorReady],
	);

	useEffect(() => {
		if (!editorHandle || !onCountChange) return;

		const updateCounts = () => {
			const text = editorHandle.document
				.map((block) => {
					const extractText = (content: unknown): string => {
						if (!content || !Array.isArray(content)) return "";
						return content
							.map((c: unknown) => {
								if (typeof c === "object" && c !== null && "text" in c) {
									return (c as { text?: string }).text || "";
								}
								return "";
							})
							.join("");
					};
					return extractText((block as { content?: unknown }).content);
				})
				.join("\n");

			const wordCount = countWords(text);
			const charCount = countChars(text);

			const selection = editorHandle.getSelection();
			let selectionCount: number | undefined;
			if (selection && selection.blocks.length > 0) {
				const selectionText = selection.blocks
					.map((block) => {
						const extractText = (content: unknown): string => {
							if (!content || !Array.isArray(content)) return "";
							return content
								.map((c: unknown) => {
									if (typeof c === "object" && c !== null && "text" in c) {
										return (c as { text?: string }).text || "";
									}
									return "";
								})
								.join("");
						};
						return extractText((block as { content?: unknown }).content);
					})
					.join("");
				selectionCount = countChars(selectionText);
			}

			onCountChange({ wordCount, charCount, selectionCount });
		};

		updateCounts();

		const originalOnChange = editorHandle.onChange;
		const wrappedOnChange = (callback: () => void) => {
			return originalOnChange(() => {
				callback();
				updateCounts();
			});
		};

		const unsubscribe = wrappedOnChange(() => {});

		const handleSelectionChange = () => {
			updateCounts();
		};

		const prosemirrorView = editorHandle.prosemirrorView;
		if (prosemirrorView) {
			prosemirrorView.dom.addEventListener("mouseup", handleSelectionChange);
			prosemirrorView.dom.addEventListener("keyup", handleSelectionChange);
		}

		return () => {
			unsubscribe();
			if (prosemirrorView) {
				prosemirrorView.dom.removeEventListener("mouseup", handleSelectionChange);
				prosemirrorView.dom.removeEventListener("keyup", handleSelectionChange);
			}
		};
	}, [editorHandle, onCountChange]);
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
		(newBlocks: BlockNoteBlock[]) => {
			if (isReadOnly) {
				return;
			}
			onBlocksChange(newBlocks);
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
	const [editorRecoveryMode, setEditorRecoveryMode] = useState(false);
	const [editorBoundaryMessage, setEditorBoundaryMessage] = useState(
		"Something went wrong in the editor.",
	);
	const { error: notifyError } = useNotification();

	const handleEditorBoundaryError = useCallback(() => {
		if (editorRecoveryMode) {
			setEditorBoundaryMessage("Something went wrong in the editor.");
			return;
		}

		if (!hasActiveExternalPlugins()) {
			setEditorBoundaryMessage("Something went wrong in the editor.");
			return;
		}

		const activePluginIds = getActiveExternalPluginIds();
		const pluginLabel =
			activePluginIds.length > 0 ? activePluginIds.join(", ") : "one or more external plugins";
		const reason = `PLUGIN_AUTO_DISABLED_ON_CRASH: editor crash recovery triggered for ${pluginLabel}`;

		setEditorRecoveryMode(true);
		setEditorBoundaryMessage(
			`A plugin issue was detected (${pluginLabel}). The document is reopened in safe mode.`,
		);
		setEditorKey((k) => k + 1);
		notifyError(
			`Plugin issue detected: ${pluginLabel}. Disabled external plugins and reopened editor.`,
		);
		void disableExternalPluginsForEditorRecovery(reason);
	}, [editorRecoveryMode, notifyError]);

	return (
		<div className="document-editor-form flex flex-col min-h-full w-full">
			<div className="flex-1 min-h-0 w-full px-2 overflow-hidden">
				<GranularErrorBoundary
					key={editorKey}
					message={editorBoundaryMessage}
					onRetry={() => setEditorKey((k) => k + 1)}
					onError={handleEditorBoundaryError}
				>
				<RichEditor
					initialContent={blocksJson}
					docKey={isEditMode ? `edit:${blocksJson ? "loaded" : "pending"}` : "new"}
					onChange={handleBlocksChange}
					onTitleChange={handleTitleChange}
					onReady={handleEditorReady}
					editable={!isLoading && !isReadOnly}
					isLoading={isLoading && isEditMode}
					autoFocus={autoFocus}
					disablePluginContributions={editorRecoveryMode}
					find={find}
					findBarRef={findBarRef}
					className="h-full"
				/>
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
							onFilter={(t) => onNavigate?.("search", { query: `tag:${t}` })}
							onKeyDown={handleTagKeyDown}
						/>
					))}
				</div>
				<div className="mt-2 text-xs text-text-dim">
					Use :tag to add tags. Click a tag to search by it, or press Delete to remove
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
	onFilter: (tag: string) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, tag: string) => void;
}

const TagChip: React.FC<TagChipProps> = React.memo(
	({ tag, isLoading, isReadOnly, onRemove, onFilter, onKeyDown }) => (
		<span className="inline-flex items-center gap-1">
			<Button
				variant="secondary"
				size="sm"
				onKeyDown={(e) => onKeyDown(e, tag)}
				onClick={() => {
					if (!isReadOnly) onFilter(tag);
				}}
				className="inline-flex items-center gap-1 text-sm"
				disabled={isLoading || isReadOnly}
				title="Click to search by this tag"
			>
				{tag}
			</Button>
			{!isReadOnly && (
				<button
					type="button"
					onClick={() => onRemove(tag)}
					disabled={isLoading}
					className="flex h-5 w-5 items-center justify-center rounded text-text-dim hover:text-text-bright hover:bg-glass-bg/30 transition-colors disabled:opacity-50"
					aria-label={`Remove ${tag}`}
					title="Remove tag"
				>
					×
				</button>
			)}
		</span>
	),
);
