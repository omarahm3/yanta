import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteBlock } from "../../shared/types/Document";
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
		console.warn(
			`[editor] Quarantined unsupported block type "${block.type}" (id: ${block.id ?? "?"})`,
		);
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
export function restoreUnknownBlocks(blocks: BlockNoteBlock[]): BlockNoteBlock[] {
	return blocks.map((block) => restoreBlock(block));
}

function restoreBlock(block: BlockNoteBlock): BlockNoteBlock {
	if (block.type === UNKNOWN_BLOCK_TYPE) {
		const originalJson = (block.props as unknown as Partial<UnknownBlockProps> | undefined)
			?.originalJson;
		if (!originalJson) {
			console.warn(`[editor] Quarantined block ${block.id} is missing originalJson; leaving as-is`);
			return block;
		}
		// Reading a stored (possibly corrupt) payload back off disk is input
		// validation: never crash the save path or destroy the quarantine
		// wrapper — leave the block as-is so it round-trips and can self-heal.
		try {
			return JSON.parse(originalJson) as BlockNoteBlock;
		} catch (err) {
			console.warn(`[editor] Failed to parse quarantined block ${block.id}; leaving as-is`, err);
			return block;
		}
	}

	if (Array.isArray(block.children) && block.children.length > 0) {
		return { ...block, children: restoreUnknownBlocks(block.children) };
	}

	return block;
}
