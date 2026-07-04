import { codeBlockOptions } from "@blocknote/code-block";
import { BlockNoteSchema, createCodeBlockSpec, type PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { useMemo } from "react";
import {
	useEditorBlockSpecs,
	useEditorStyleSpecs,
} from "../editor/extensions/registry/editorExtensionRegistry";
import "./preview.css";

interface DocumentPreviewProps {
	blocksJson: string;
}

/**
 * Read-only document preview for the finder. Rather than mounting the editor
 * (whose editing UI can't live inside the finder's dialog portal — its slash
 * menu calls useBlockNoteEditor outside a BlockNoteView), this uses BlockNote
 * purely as a converter: it builds an editor with the same block/style specs as
 * the real editor, exports the blocks to plain HTML (no view mount required),
 * and renders that. No editing surface, no BlockNote React tree, no new deps.
 */
export function DocumentPreview({ blocksJson }: DocumentPreviewProps) {
	const blockSpecs = useEditorBlockSpecs();
	const styleSpecs = useEditorStyleSpecs();

	const schema = useMemo(
		() =>
			BlockNoteSchema.create().extend({
				blockSpecs: { ...blockSpecs, codeBlock: createCodeBlockSpec(codeBlockOptions) },
				styleSpecs,
			}),
		[blockSpecs, styleSpecs],
	);

	// A converter instance — never mounted; only used for blocks → HTML export.
	const editor = useCreateBlockNote({ schema });

	const html = useMemo(() => {
		let blocks: PartialBlock[];
		try {
			const parsed = JSON.parse(blocksJson);
			blocks = Array.isArray(parsed) ? (parsed as PartialBlock[]) : [];
		} catch {
			return "";
		}
		if (blocks.length === 0) return "";
		try {
			return editor.blocksToHTMLLossy(blocks);
		} catch {
			return "";
		}
	}, [editor, blocksJson]);

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
