import type { Block } from "@blocknote/core";

export function blocksToJson(blocks: Block[]): string {
	return JSON.stringify(blocks);
}

export function blocksFromJson(json: string): Block[] | undefined {
	try {
		return JSON.parse(json) as Block[];
	} catch (error) {
		console.error("Failed to parse blocks from JSON:", error);
		return undefined;
	}
}

export function extractTitle(blocks: Block[]): string {
	if (!blocks || blocks.length === 0) {
		return "";
	}

	const heading = blocks.find(
		(block) =>
			block.type === "heading" &&
			block.content &&
			Array.isArray(block.content) &&
			block.content.length > 0,
	);

	if (heading && Array.isArray(heading.content)) {
		return extractTextFromContent(heading.content);
	}

	const paragraph = blocks.find(
		(block) =>
			block.type === "paragraph" &&
			block.content &&
			Array.isArray(block.content) &&
			block.content.length > 0,
	);

	if (paragraph && Array.isArray(paragraph.content)) {
		return extractTextFromContent(paragraph.content);
	}

	return "";
}

interface TextContent {
	type: "text";
	text?: string;
}

function extractTextFromContent(content: unknown[]): string {
	return content
		.filter(
			(item): item is TextContent =>
				typeof item === "object" &&
				item !== null &&
				"type" in item &&
				item.type === "text" &&
				"text" in item &&
				typeof item.text === "string",
		)
		.map((item) => item.text)
		.join("")
		.trim();
}

export function createSimpleBlock(text: string): Block {
	return {
		type: "paragraph",
		content: [
			{
				type: "text",
				text,
			},
		],
	} as Block;
}

export function isEmptyContent(blocks: Block[]): boolean {
	if (!blocks || blocks.length === 0) {
		return true;
	}

	return blocks.every((block) => {
		if (!block.content || !Array.isArray(block.content)) {
			return true;
		}
		const text = extractTextFromContent(block.content);
		return text.length === 0;
	});
}

export function extractHashtags(text: string): string[] {
	const hashtagRegex = /#(\w+)/g;
	const matches = text.match(hashtagRegex);

	if (!matches) {
		return [];
	}

	return [...new Set(matches.map((tag) => tag.substring(1)))];
}

export function removeHashtags(text: string): string {
	return text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim();
}
