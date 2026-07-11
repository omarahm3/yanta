import type { BlockNoteBlock } from "../../shared/types/Document";

export interface HeadingItem {
	id: string;
	level: number;
	text: string;
}

/**
 * Extracts H1-H3 headings from editor blocks for the document outline/TOC.
 * Returns headings in document order with their level and text content.
 */
export function extractHeadings(blocks: BlockNoteBlock[]): HeadingItem[] {
	const headings: HeadingItem[] = [];

	for (const block of blocks) {
		if (block.type === "heading" && block.props?.level) {
			const level = block.props.level as number;
			if (level >= 1 && level <= 3) {
				const text = extractTextFromContent(block.content);
				headings.push({ id: block.id, level, text });
			}
		}
	}

	return headings;
}

function extractTextFromContent(content: BlockNoteBlock["content"]): string {
	if (!content || !Array.isArray(content)) return "";
	return content
		.map((c) => {
			if (typeof c === "object" && c !== null && "text" in c) {
				return (c as { text?: string }).text || "";
			}
			return "";
		})
		.join("");
}
