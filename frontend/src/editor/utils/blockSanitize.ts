import type { Block, PartialBlock } from "@blocknote/core";
import { UNKNOWN_BLOCK_TYPE, type UnknownBlockProps } from "../extensions/unknownBlock/constants";

/**
 * Wraps any block whose type is absent from the active editor schema in an
 * `unknownBlock` placeholder that stores the original block verbatim. Prevents
 * BlockNote from dereferencing `pmSchema.nodes[type]` on an unknown type — the
 * crash that kills the whole editor pane. Runs at the read boundary, before the
 * blocks reach `useCreateBlockNote`. Reverse of {@link restoreUnknownBlocks}.
 */
export function sanitizeUnknownBlocks(
	blocks: PartialBlock[],
	knownTypes: ReadonlySet<string>,
): PartialBlock[] {
	return blocks.map((block) => sanitizeBlock(block, knownTypes));
}

function sanitizeBlock(block: PartialBlock, knownTypes: ReadonlySet<string>): PartialBlock {
	if (block.type && !knownTypes.has(block.type)) {
		console.warn(`[editor] Quarantined unsupported block type "${block.type}" (id: ${block.id ?? "?"})`);
		const props: UnknownBlockProps = {
			originalType: block.type,
			originalJson: JSON.stringify(block),
		};
		return { type: UNKNOWN_BLOCK_TYPE, props } as unknown as PartialBlock;
	}

	if (Array.isArray(block.children) && block.children.length > 0) {
		return {
			...block,
			children: block.children.map((child) => sanitizeBlock(child, knownTypes)),
		} as PartialBlock;
	}

	return block;
}

/**
 * Reverses {@link sanitizeUnknownBlocks}: replaces each `unknownBlock`
 * placeholder with the original block parsed from its stored JSON, so saved
 * documents round-trip losslessly and self-heal once the missing block type
 * (plugin / version) becomes available again. Runs at the save boundary.
 */
export function restoreUnknownBlocks(blocks: Block[]): Block[] {
	return blocks.map((block) => restoreBlock(block));
}

function restoreBlock(block: Block): Block {
	if (block.type === UNKNOWN_BLOCK_TYPE) {
		const originalJson = (block.props as Partial<UnknownBlockProps>).originalJson;
		if (!originalJson) {
			throw new Error(`Quarantined block ${block.id} is missing originalJson`);
		}
		return JSON.parse(originalJson) as Block;
	}

	if (Array.isArray(block.children) && block.children.length > 0) {
		return { ...block, children: restoreUnknownBlocks(block.children) };
	}

	return block;
}
