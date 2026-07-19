import type { BlockNoteBlock, DocumentKind } from "../../shared/types/Document";

export const createTitleBlock = (title: string): BlockNoteBlock => ({
	id: crypto.randomUUID(),
	type: "heading",
	props: { level: 1 },
	content: [
		{
			type: "text",
			text: title,
			styles: {},
		},
	],
});

export const createEmptyDocument = (
	title?: string,
): {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
	kind: DocumentKind;
} => ({
	title: title || "",
	blocks: title ? [createTitleBlock(title)] : [],
	tags: [],
	kind: "document",
});
