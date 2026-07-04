import type { BlockNoteBlock } from "../types/Document";

interface NormalizedBlock {
	type: string;
	props: Record<string, unknown> | undefined;
	content: unknown;
	children: NormalizedBlock[] | undefined;
}

// BlockNote injects these cosmetic props with default values when it hydrates a
// document. Disk blocks written by seeds / older versions omit them. Stripping
// default-valued props makes the sparse (on-disk) and hydrated (editor)
// representations hash identically, so opening a document doesn't register as a
// phantom change on the first edit. "absent" and "= default" are semantically
// identical in BlockNote, so dropping them never hides a real change.
const DEFAULT_PROP_VALUES: Record<string, unknown> = {
	textColor: "default",
	backgroundColor: "default",
	textAlignment: "left",
};

function normalizeProps(
	props: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!props) {
		return undefined;
	}
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(props)) {
		if (DEFAULT_PROP_VALUES[key] === value) {
			continue;
		}
		out[key] = value;
	}
	// Collapse an all-default (or empty) props object to undefined so it hashes
	// identically to an on-disk block that omits the key entirely.
	return Object.keys(out).length > 0 ? out : undefined;
}

export function computeContentHash(blocks: BlockNoteBlock[]): string {
	const normalizeBlock = (block: BlockNoteBlock): NormalizedBlock => ({
		type: block.type,
		props: normalizeProps(block.props),
		content: block.content,
		// Treat "no children" and "empty children" as equivalent.
		children:
			block.children && block.children.length > 0 ? block.children.map(normalizeBlock) : undefined,
	});

	return JSON.stringify(blocks.map(normalizeBlock));
}
