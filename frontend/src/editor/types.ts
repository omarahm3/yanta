import type {
	Block,
	BlockNoteEditor,
	BlockSpecs,
	ExtensionFactoryInstance,
	StyleSpecs,
} from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import type { AnyExtension } from "@tiptap/core";
import type { BlockNoteBlock } from "../shared/types/Document";

/**
 * Single owned boundary for the active rich-text editor's runtime types. App
 * code outside `editor/` (document hooks/components, services, search preview,
 * the plugin ABI) imports these aliases and the converter below instead of
 * `@blocknote/*` directly, so swapping the editor stays confined to `editor/`
 * plus this file — the same isolation the Wails model→frontend converters give
 * the backend boundary.
 */

export type EditorHandle = BlockNoteEditor;
export type EditorBlock = Block;

export type EditorExtensionInstance = ExtensionFactoryInstance;
export type EditorTipTapExtension = AnyExtension;
export type EditorBlockSpecMap = BlockSpecs;
export type EditorStyleSpecMap = StyleSpecs;
export type EditorReactSuggestionItem = DefaultReactSuggestionItem;

/**
 * The on-disk block shape ({@link BlockNoteBlock}) and the editor's runtime
 * block are the same JSON; this converter is the single audited cast between
 * them so no call site reaches for `as unknown as`.
 */
export function fromEditorBlocks(blocks: EditorBlock[]): BlockNoteBlock[] {
	return blocks as unknown as BlockNoteBlock[];
}
