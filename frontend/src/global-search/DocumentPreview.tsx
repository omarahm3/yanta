import { useMemo } from "react";
import {
	useEditorBlockSpecs,
	useEditorStyleSpecs,
} from "../editor/extensions/registry/editorExtensionRegistry";
import { blocksJsonToPreviewHTML } from "../editor/preview";
import "./preview.css";

interface DocumentPreviewProps {
	blocksJson: string;
}

/**
 * Read-only document preview for the finder. Delegates to the editor's headless
 * preview converter ({@link blocksJsonToPreviewHTML}) so this component never
 * imports the editor runtime directly — the block/style specs come from the
 * plugin registry hooks and are passed through as opaque, app-owned maps.
 */
export function DocumentPreview({ blocksJson }: DocumentPreviewProps) {
	const blockSpecs = useEditorBlockSpecs();
	const styleSpecs = useEditorStyleSpecs();

	const html = useMemo(
		() => blocksJsonToPreviewHTML(blocksJson, blockSpecs, styleSpecs),
		[blocksJson, blockSpecs, styleSpecs],
	);

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
