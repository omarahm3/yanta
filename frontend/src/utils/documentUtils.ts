import type { BlockNoteBlock } from "../types/Document";

export const extractTitleFromBlocks = (blocks: BlockNoteBlock[]): string => {
	if (!blocks || blocks.length === 0) return "Untitled";

	const firstBlock = blocks[0];
	if (firstBlock.type !== "heading" || firstBlock.props?.level !== 1) {
		return "Untitled";
	}

	const text = firstBlock.content
		?.map((c) => c.text || "")
		.join("")
		.trim();

	if (!text) return "Untitled";

	return text.length > 200 ? text.substring(0, 200) + "..." : text;
};
