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

	// Recurse so headings nested inside lists/callouts/groups (children blocks)
	// are also surfaced in the outline, not just top-level ones.
	const walk = (bs: BlockNoteBlock[]) => {
		for (const block of bs) {
			if (block.type === "heading" && block.props?.level) {
				const level = block.props.level as number;
				if (level >= 1 && level <= 3) {
					headings.push({ id: block.id, level, text: extractTextFromContent(block.content) });
				}
			}
			const children = (block as { children?: BlockNoteBlock[] }).children;
			if (Array.isArray(children) && children.length > 0) {
				walk(children);
			}
		}
	};
	walk(blocks);

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
