import { codeBlockOptions } from "@blocknote/code-block";
import { BlockNoteEditor, BlockNoteSchema, createCodeBlockSpec, type PartialBlock } from "@blocknote/core";
import { useMemo } from "react";
import { UNKNOWN_BLOCK_TYPE, unknownBlockSpec } from "../editor/extensions/unknownBlock";
import {
	useEditorBlockSpecs,
	useEditorStyleSpecs,
} from "../editor/extensions/registry/editorExtensionRegistry";
import { sanitizeUnknownBlocks } from "../editor/utils/blockSanitize";
import "./preview.css";

interface DocumentPreviewProps {
	blocksJson: string;
}

type EditorBlockSpecs = ReturnType<typeof useEditorBlockSpecs>;
type EditorStyleSpecs = ReturnType<typeof useEditorStyleSpecs>;

// A single headless converter is reused across previews. Building a fresh
// BlockNote/ProseMirror editor for every previewed document is wasteful (the
// finder swaps documents rapidly); the converter only needs to be rebuilt when
// the active block/style spec set changes (e.g. a plugin loads).
let cachedEditor: BlockNoteEditor | null = null;
let cachedKey: string | null = null;

function getConverter(blockSpecs: EditorBlockSpecs, styleSpecs: EditorStyleSpecs): BlockNoteEditor {
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
	cachedEditor = BlockNoteEditor.create({ schema });
	cachedKey = key;
	return cachedEditor;
}

/**
 * Read-only document preview for the finder. Rather than mounting the editor
 * (whose editing UI can't live inside the finder's dialog portal), this uses a
 * shared headless BlockNote instance purely as a converter: blocks are sanitized
 * against the schema (unknown types → placeholder, never a throw) and exported to
 * plain HTML via blocksToHTMLLossy. No editing surface, no BlockNote React tree.
 */
export function DocumentPreview({ blocksJson }: DocumentPreviewProps) {
	const blockSpecs = useEditorBlockSpecs();
	const styleSpecs = useEditorStyleSpecs();

	const editor = getConverter(blockSpecs, styleSpecs);
	const knownTypes = useMemo(() => new Set(Object.keys(editor.schema.blockSpecs)), [editor]);

	const html = useMemo(() => {
		let blocks: PartialBlock[];
		try {
			const parsed = JSON.parse(blocksJson);
			blocks = Array.isArray(parsed) ? (parsed as PartialBlock[]) : [];
		} catch (error) {
			console.warn("[preview] failed to parse document blocks", error);
			return "";
		}
		if (blocks.length === 0) return "";
		try {
			return editor.blocksToHTMLLossy(sanitizeUnknownBlocks(blocks, knownTypes));
		} catch (error) {
			console.warn("[preview] failed to export document to HTML", error);
			return "";
		}
	}, [editor, knownTypes, blocksJson]);

	if (!html) {
		return <p className="px-4 py-3 text-sm text-text-dim">This document is empty.</p>;
	}

	return (
		<div
			className="gs-preview h-full overflow-y-auto px-4 py-3"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is produced by BlockNote's exporter from the user's own document blocks
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
