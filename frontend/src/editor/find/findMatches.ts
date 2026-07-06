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

		// Accumulate a contiguous run of inline text with a parallel char→position
		// map, flushing (and searching) whenever an inline atom breaks the run.
		let text = "";
		let charPos: number[] = [];

		const flush = () => {
			if (text.length >= needle.length) {
				const hay = caseSensitive ? text : text.toLowerCase();
				let idx = hay.indexOf(needle);
				while (idx !== -1) {
					matches.push({ from: charPos[idx], to: charPos[idx + needle.length - 1] + 1 });
					idx = hay.indexOf(needle, idx + needle.length);
				}
			}
			text = "";
			charPos = [];
		};

		node.forEach((child, offset) => {
			if (child.isText && child.text) {
				const base = pos + 1 + offset;
				for (let i = 0; i < child.text.length; i++) {
					text += child.text[i];
					charPos.push(base + i);
				}
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
