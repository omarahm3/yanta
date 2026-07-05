import { codeBlockOptions } from "@blocknote/code-block";
import {
	BlockNoteEditor,
	BlockNoteSchema,
	createCodeBlockSpec,
	type PartialBlock,
} from "@blocknote/core";
import { UNKNOWN_BLOCK_TYPE, unknownBlockSpec } from "./extensions/unknownBlock";
import {
	type EditorBlockSpecMap,
	type EditorHandle,
	type EditorStyleSpecMap,
	toEditorHandle,
} from "./types";
import { sanitizeUnknownBlocks } from "./utils/blockSanitize";

// A single headless converter is reused across previews. Building a fresh
// BlockNote/ProseMirror editor for every previewed document is wasteful (the
// finder swaps documents rapidly); the converter is rebuilt only when the
// active block/style spec set changes (e.g. a plugin loads).
let cachedEditor: EditorHandle | null = null;
let cachedKey: string | null = null;

function getConverter(
	blockSpecs: EditorBlockSpecMap,
	styleSpecs: EditorStyleSpecMap,
): EditorHandle {
	const key = `${Object.keys(blockSpecs).sort().join(",")}|${Object.keys(styleSpecs).sort().join(",")}`;
	if (cachedEditor && cachedKey === key) {
		return cachedEditor;
	}
	const schema = BlockNoteSchema.create().extend({
		blockSpecs: {
			...blockSpecs,
			codeBlock: createCodeBlockSpec(codeBlockOptions),
			[UNKNOWN_BLOCK_TYPE]: unknownBlockSpec,
		},
		styleSpecs,
	});
	cachedEditor = toEditorHandle(BlockNoteEditor.create({ schema }));
	cachedKey = key;
	return cachedEditor;
}

/**
 * Converts a document's stored blocks JSON to read-only preview HTML using a
 * shared headless BlockNote instance purely as a converter — no editing
 * surface, no BlockNote React tree. Blocks are sanitized against the schema
 * (unknown types → placeholder, never a throw) and exported via
 * `blocksToHTMLLossy`. Returns "" for empty/unparseable/unexportable input.
 */
export function blocksJsonToPreviewHTML(
	blocksJson: string,
	blockSpecs: EditorBlockSpecMap,
	styleSpecs: EditorStyleSpecMap,
): string {
	let blocks: PartialBlock[];
	try {
		const parsed = JSON.parse(blocksJson);
		blocks = Array.isArray(parsed) ? (parsed as PartialBlock[]) : [];
	} catch (error) {
		console.warn("[preview] failed to parse document blocks", error);
		return "";
	}
	if (blocks.length === 0) return "";

	let editor: EditorHandle;
	try {
		editor = getConverter(blockSpecs, styleSpecs);
	} catch (error) {
		console.warn("[preview] failed to build the preview converter", error);
		return "";
	}
	const knownTypes = new Set(Object.keys(editor.schema.blockSpecs));
	try {
		return editor.blocksToHTMLLossy(sanitizeUnknownBlocks(blocks, knownTypes));
	} catch (error) {
		console.warn("[preview] failed to export document to HTML", error);
		return "";
	}
}
