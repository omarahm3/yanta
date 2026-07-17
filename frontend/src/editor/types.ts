import type {
	Block,
	BlockNoteEditor,
	BlockSchema,
	BlockSpecs,
	ExtensionFactoryInstance,
	InlineContentSchema,
	StyleSchema,
	StyleSpecs,
} from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import type { AnyExtension } from "@tiptap/core";
import type { BlockNoteBlock } from "../shared/types/Document";

/**
 * Single owned boundary for the active rich-text editor's runtime types. App
 * code outside `editor/` (document hooks/components, services, search preview,
 * the plugin ABI) imports these aliases and the converters below instead of
 * `@blocknote/*` directly, so swapping the editor stays confined to `editor/`
 * plus this file — the same isolation the Wails model→frontend converters give
 * the backend boundary.
 */

// The schema-agnostic editor handle app code holds. The concrete editor is
// built with a custom schema; BlockNote's editor generics are invariant, so a
// custom-schema editor is not assignable to this default-schema handle — cross
// that seam only through `toEditorHandle`.
export type EditorHandle = BlockNoteEditor;

/**
 * Imperative export handle a mounted CanvasEditor hands up to the controller so
 * the command palette can render the live canvas to an image. Rendering must run
 * against Excalidraw's live API (it holds the hydrated image dataURLs and the
 * exact on-screen viewport), so the editor owns it and exposes it as bytes/text.
 */
export interface CanvasExportHandle {
	/** Render the current scene to a PNG blob. */
	toPNG: () => Promise<Blob>;
	/** Render the current scene to serialized SVG markup. */
	toSVG: () => Promise<string>;
}

export type EditorExtensionInstance = ExtensionFactoryInstance;
export type EditorTipTapExtension = AnyExtension;
export type EditorBlockSpecMap = BlockSpecs;
export type EditorStyleSpecMap = StyleSpecs;
export type EditorReactSuggestionItem = DefaultReactSuggestionItem;

/**
 * Exposes a concrete editor (of any schema) to consumers as the opaque
 * {@link EditorHandle}. The generic infers the real schema at the call site so
 * no `any` is needed; the cast to the default-schema handle is the single
 * audited place that erases the schema for opaque consumers.
 */
export function toEditorHandle<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>): EditorHandle {
	return editor as unknown as EditorHandle;
}

/**
 * Converts the editor's runtime blocks (of any schema) to the on-disk domain
 * block shape. Single audited cast between the two representations.
 */
export function fromEditorBlocks<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(blocks: Block<B, I, S>[]): BlockNoteBlock[] {
	return blocks as unknown as BlockNoteBlock[];
}
