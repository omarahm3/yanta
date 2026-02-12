import type { Block } from "@blocknote/core";

interface NormalizedBlock {
	type: string;
	props: Record<string, unknown> | undefined;
	content: unknown;
	children: NormalizedBlock[] | undefined;
}

export function computeContentHash(blocks: Block[]): string {
	const normalizeBlock = (block: Block): NormalizedBlock => ({
		type: block.type,
		props: block.props,
		content: block.content,
		children: block.children?.map(normalizeBlock),
	});

	return JSON.stringify(blocks.map(normalizeBlock));
}
