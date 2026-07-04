import React from "react";
import "@blocknote/core/fonts/inter.css";
import type { PartialBlock } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useResolvedTheme } from "../shared/stores/theme.store";
import { cn } from "../shared/utils/cn";
import "../styles/blocknote-dark.css";
import "../styles/blocknote-scale.css";
import type { EditorSlashMenuItemContribution } from "./extensions/registry/editorExtensionRegistry";
import "./extensions/rtl/rtl.css";
import { useRichEditorInner } from "./hooks/useRichEditorInner";
import { portalledShadCNComponents } from "./portalledShadCN";
import type { EditorBlock, EditorHandle } from "./types";
import { needsLeadingH1 } from "./utils/blockNormalize";

export interface RichEditorProps {
	initialContent?: string;
	onChange?: (blocks: EditorBlock[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: EditorHandle) => void;
	className?: string;
	editable?: boolean;
	isLoading?: boolean;
	docKey?: string;
	autoFocus?: boolean;
	disablePluginContributions?: boolean;
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
	onChange?: (blocks: EditorBlock[]) => void;
	onTitleChange?: (title: string) => void;
	onReady?: (editor: EditorHandle) => void;
	className?: string;
	editable: boolean;
	autoFocus: boolean;
	disablePluginContributions: boolean;
};

interface PluginSlashMenuProps {
	editor: EditorHandle;
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
						void Promise.resolve(onItemClick({ editor, editable })).catch((err) => {
							console.error("[plugin] slash menu action failed", {
								itemTitle: rest.title,
								error: err,
							});
						});
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
	(
		{
			blocks,
			onChange,
			onTitleChange,
			onReady,
			className,
			editable,
			autoFocus,
			disablePluginContributions,
		},
		ref,
	) => {
		const resolvedTheme = useResolvedTheme();
		const { editor, isReady, scale, focusMode, containerRefCallback, pluginSlashMenuItems } =
			useRichEditorInner({
				blocks,
				onChange,
				onTitleChange,
				onReady,
				editable,
				autoFocus,
				disablePluginContributions,
			});

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
				data-focus-mode={focusMode ? "true" : undefined}
			>
				<BlockNoteView
					editor={editor}
					theme={resolvedTheme}
					slashMenu={false}
					shadCNComponents={portalledShadCNComponents}
				>
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
			disablePluginContributions = false,
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
				if (needsLeadingH1(blocks)) {
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
				disablePluginContributions={disablePluginContributions}
			/>
		);
	},
);

RichEditor.displayName = "RichEditor";
