import type { Node as PMNode } from "@tiptap/pm/model";

export interface FindMatch {
	/** ProseMirror position of the first character of the match. */
	from: number;
	/** ProseMirror position just after the last character of the match. */
	to: number;
}

export interface FindOptions {
	caseSensitive?: boolean;
}

/** A contiguous text node within a block: its start index in the block's
 * concatenated text and the ProseMirror position of its first character. */
interface TextSegment {
	startIdx: number;
	basePos: number;
}

/** Map an index in a block's concatenated text back to a ProseMirror position. */
function mapIndexToPos(idx: number, segments: TextSegment[]): number {
	for (let i = segments.length - 1; i >= 0; i--) {
		const seg = segments[i];
		if (idx >= seg.startIdx) {
			return seg.basePos + (idx - seg.startIdx);
		}
	}
	return 0;
}

/**
 * Find every occurrence of `query` in `doc`, returned as ProseMirror `{from,to}`
 * ranges in document order.
 *
 * Matching is per-textblock: a match never spans block boundaries. Within a
 * block, text split across marks (bold/italic/…) is contiguous, so a search
 * still matches across formatting. Inline atoms (images, hard breaks) break a
 * run — a match won't cross one.
 */
export function findMatches(doc: PMNode, query: string, options: FindOptions = {}): FindMatch[] {
	const matches: FindMatch[] = [];
	if (!query) return matches;

	const caseSensitive = options.caseSensitive ?? false;
	const needle = caseSensitive ? query : query.toLowerCase();

	doc.descendants((node, pos) => {
		// Recurse through containers (lists, tables, quotes) to reach textblocks.
		if (!node.isTextblock) return true;

		// Accumulate a contiguous run of inline text by whole text node (find runs
		// live on every keystroke, so avoid per-character work), tracking each node
		// as a segment so match indices map back to positions. An inline atom
		// breaks the run.
		let text = "";
		const segments: TextSegment[] = [];

		const flush = () => {
			if (text.length >= needle.length) {
				const hay = caseSensitive ? text : text.toLowerCase();
				let idx = hay.indexOf(needle);
				while (idx !== -1) {
					matches.push({
						from: mapIndexToPos(idx, segments),
						to: mapIndexToPos(idx + needle.length, segments),
					});
					idx = hay.indexOf(needle, idx + needle.length);
				}
			}
			text = "";
			segments.length = 0;
		};

		node.forEach((child, offset) => {
			if (child.isText && child.text) {
				segments.push({ startIdx: text.length, basePos: pos + 1 + offset });
				text += child.text;
			} else {
				// Inline atom — cannot be part of a text match.
				flush();
			}
		});
		flush();

		// Inline content handled here; no need to descend further.
		return false;
	});

	return matches;
}
