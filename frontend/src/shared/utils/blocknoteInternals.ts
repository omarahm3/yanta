// Centralized access to BlockNote / Tiptap / ProseMirror internals that are NOT
// part of BlockNote's public API. Every unofficial reach-through lives here so a
// version bump that renames or reshapes an internal fails in ONE place (guarded
// by blocknoteInternals.test.ts) instead of silently across the app.
// See bnote-stable.md P2.
import type {
	BlockNoteEditor,
	BlockSchema,
	InlineContentSchema,
	StyleSchema,
} from "@blocknote/core";
import type { Plugin, PluginKey } from "prosemirror-state";

// Helpers accept an editor of ANY schema. BlockNote's editor generics are
// invariant, so a param typed with the base-constraint schemas would reject a
// custom-schema editor; the type parameters infer the real schema at each call
// site instead (no `any`). Access to schema-typed internals casts to the
// default-schema editor via `unknown` — safe here since these reach for private
// members / default blocks that exist regardless of schema.

export interface TiptapInternalEditor {
	isDestroyed?: boolean;
	isInitialized?: boolean;
	registerPlugin: (plugin: Plugin) => unknown;
	unregisterPlugin: (nameOrKey: string | PluginKey | (string | PluginKey)[]) => unknown;
}

type WithTiptap = BlockNoteEditor & { _tiptapEditor?: TiptapInternalEditor };

/** The private Tiptap editor backing a BlockNote editor, or null if unavailable. */
export function getTiptapEditor<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>): TiptapInternalEditor | null {
	if (!editor) {
		return null;
	}
	return (editor as unknown as WithTiptap)._tiptapEditor ?? null;
}

/**
 * True only if the editor is mounted in the DOM and its underlying Tiptap view
 * is not destroyed. Guards against BlockNote firing a final `onChange` (or a
 * cursor op) against a torn-down view, which throws Tiptap's
 * `view['posAtDOM']... not mounted yet`.
 */
export function isEditorAlive<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>): boolean {
	if (!editor || !editor.domElement?.isConnected) {
		return false;
	}
	const tiptap = getTiptapEditor(editor);
	if (tiptap?.isDestroyed) {
		return false;
	}
	return true;
}

/** Matches Tiptap's transient pre-mount "editor view is not available" error. */
export function isEditorViewUnavailableError(error: unknown): boolean {
	return error instanceof Error && error.message.includes("The editor view is not available");
}

// --- Image block file-accept (Linux WebKitGTK file-picker workaround) ---

interface ImageBlockMeta {
	fileBlockAccept?: string[];
	[key: string]: unknown;
}

function getImageBlockImplementation(editor: BlockNoteEditor): { meta?: ImageBlockMeta } | null {
	if (!editor?.schema?.blockSpecs) {
		return null;
	}
	const imageSpec = editor.schema.blockSpecs.image;
	if (!imageSpec || !imageSpec.implementation) {
		return null;
	}
	return imageSpec.implementation as { meta?: ImageBlockMeta };
}

/** The MIME patterns the image block currently accepts (non-empty strings only). */
export function getImageBlockAcceptList<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>): string[] {
	const impl = getImageBlockImplementation(editor as unknown as BlockNoteEditor);
	const accept = impl?.meta?.fileBlockAccept;
	if (!Array.isArray(accept)) {
		return [];
	}
	return accept.filter(
		(entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
	);
}

/**
 * Forces the image block to accept only the given MIME patterns. Needed on Linux
 * where WebKitGTK's file dialog ignores a broad accept list. Returns false when
 * the internal meta shape can't be found so callers can warn in DEV.
 */
export function setImageBlockAccept<
	B extends BlockSchema,
	I extends InlineContentSchema,
	S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, accept: string[]): boolean {
	const impl = getImageBlockImplementation(editor as unknown as BlockNoteEditor);
	if (!impl) {
		return false;
	}
	impl.meta = { ...(impl.meta ?? {}), fileBlockAccept: accept };
	return true;
}
