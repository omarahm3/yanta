import React from "react";
import "@blocknote/core/fonts/inter.css";
import type { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { cn } from "../shared/utils/cn";
import "../styles/blocknote-dark.css";
import "../styles/blocknote-scale.css";
import type { EditorSlashMenuItemContribution } from "./extensions/registry/editorExtensionRegistry";
import "./extensions/rtl/rtl.css";
import { useRichEditorInner } from "./hooks/useRichEditorInner";

export interface RichEditorProps {
	initialContent?: string;
	onChange?: (blocks: Block[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: BlockNoteEditor) => void;
	className?: string;
	editable?: boolean;
	isLoading?: boolean;
	docKey?: string;
	autoFocus?: boolean;
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
	autoFocus: boolean;
};

interface PluginSlashMenuProps {
	editor: BlockNoteEditor;
	editable: boolean;
	items: EditorSlashMenuItemContribution[];
}

const PluginSlashMenu: React.FC<PluginSlashMenuProps> = ({ editor, editable, items }) => {
	const getItems = React.useCallback(
		async (query: string) => {
			const defaultItems = getDefaultReactSlashMenuItems(editor);
			if (items.length === 0) {
				return filterSuggestionItems(defaultItems, query);
			}

			const pluginItems = items.map((item) => {
				const { order: _order, onItemClick, ...rest } = item;
				return {
					...rest,
					onItemClick: () => {
						void onItemClick({ editor, editable });
					},
				};
			});
			return filterSuggestionItems([...defaultItems, ...pluginItems], query);
		},
		[editor, editable, items],
	);

	return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />;
};

const EditorInner = React.forwardRef<HTMLDivElement, EditorInnerProps>(
	({ blocks, onChange, onTitleChange, onReady, className, editable, autoFocus }, ref) => {
		const { editor, isReady, scale, containerRefCallback, pluginSlashMenuItems } = useRichEditorInner(
			{
				blocks,
				onChange,
				onTitleChange,
				onReady,
				editable,
				autoFocus,
			},
		);

		const mergedRef = React.useCallback(
			(node: HTMLDivElement | null) => {
				containerRefCallback(node);
				if (typeof ref === "function") {
					ref(node);
				} else if (ref) {
					(ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
				}
			},
			[ref, containerRefCallback],
		);

		if (!editor || !isReady) {
			return <div ref={mergedRef} className={cn("h-full w-full", className)} />;
		}

		return (
			<div
				ref={mergedRef}
				className={cn("rich-editor flex-1 overflow-y-auto h-full", className)}
				style={{ "--editor-scale": scale } as React.CSSProperties}
			>
				<BlockNoteView editor={editor} theme="dark" slashMenu={false}>
					<PluginSlashMenu editor={editor} editable={editable} items={pluginSlashMenuItems} />
				</BlockNoteView>
			</div>
		);
	},
);

EditorInner.displayName = "EditorInner";

export const RichEditor = React.forwardRef<HTMLDivElement, RichEditorProps>(
	(
		{
			initialContent,
			onChange,
			onTitleChange,
			onReady,
			className,
			editable = true,
			isLoading = false,
			docKey,
			autoFocus = true,
		},
		ref,
	) => {
		const parsed = React.useMemo(() => {
			if (isLoading) return { ready: false as const, blocks: [] as PartialBlock[] };
			if (!initialContent || initialContent.trim() === "") {
				return { ready: true as const, blocks: [createDefaultInitialBlock()] };
			}
			try {
				const parsed = JSON.parse(initialContent);
				const blocks: PartialBlock[] = Array.isArray(parsed) ? (parsed as PartialBlock[]) : [];
				if (blocks.length === 0 || blocks[0].type !== "heading" || blocks[0].props?.level !== 1) {
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
				<div ref={ref} className={cn("flex items-center justify-center h-full", className)}>
					<div className="text-text-dim">Loading document...</div>
				</div>
			);
		}

		const contentKey =
			docKey ?? (initialContent && initialContent.trim() !== "" ? "__content__" : "__empty__");

		return (
			<EditorInner
				ref={ref}
				key={contentKey}
				blocks={parsed.blocks}
				onChange={onChange}
				onTitleChange={onTitleChange}
				onReady={onReady}
				className={className}
				editable={editable}
				autoFocus={autoFocus}
			/>
		);
	},
);

RichEditor.displayName = "RichEditor";
