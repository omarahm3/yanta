import React from "react";

const OPERATORS = new Set(["AND", "OR", "NOT"]);

/**
 * Pull the highlightable words out of a search query: drop `field:value` filters,
 * `-exclusions`, boolean operators, surrounding quotes, and trailing `*`. What
 * remains are the plain terms a user expects to see lit up in the preview.
 */
export function extractSearchTerms(query: string): string[] {
	return query
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean)
		.filter((token) => !token.includes(":"))
		.filter((token) => !token.startsWith("-"))
		.filter((token) => !OPERATORS.has(token.toUpperCase()))
		.map((token) => token.replace(/^["']+|["']+$/g, "").replace(/\*+$/, ""))
		.filter((token) => token.length > 0);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wrap each case-insensitive occurrence of `terms` in a `<mark>`. Returns React
 * nodes (never raw HTML) so preview text stays XSS-safe even though it comes from
 * the user's own files.
 */
export function highlightTerms(text: string, terms: string[]): React.ReactNode {
	const escaped = terms.map(escapeRegExp).filter(Boolean);
	if (escaped.length === 0) {
		return text;
	}

	const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
	const parts = text.split(pattern);

	return parts.map((part, index) =>
		// Capturing-group splits put matches on the odd indices.
		index % 2 === 1 ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and stable within one render
			<mark key={index} className="rounded bg-yellow/20 px-0.5 font-semibold text-yellow">
				{part}
			</mark>
		) : (
			// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and stable within one render
			<React.Fragment key={index}>{part}</React.Fragment>
		),
	);
}
