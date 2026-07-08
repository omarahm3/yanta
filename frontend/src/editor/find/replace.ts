import type { Transaction } from "prosemirror-state";
import type { FindMatch } from "./findMatches";

/**
 * Replace a single match's range with `replacement` on the given transaction.
 */
export function applyReplaceOne(
	tr: Transaction,
	match: FindMatch,
	replacement: string,
): Transaction {
	return tr.insertText(replacement, match.from, match.to);
}

/**
 * Replace every match with `replacement` on a single transaction. Edits are
 * applied from the last match to the first so each replacement leaves the
 * earlier (lower) positions untouched — no position mapping required.
 */
export function applyReplaceAll(
	tr: Transaction,
	matches: FindMatch[],
	replacement: string,
): Transaction {
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];
		tr.insertText(replacement, match.from, match.to);
	}
	return tr;
}
