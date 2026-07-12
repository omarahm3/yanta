/**
 * Shared query parser for the search page and global finder.
 *
 * Both surfaces support a subset of operators:
 *   - `project:alias` — filter by project alias
 *   - `tag:name` — filter by tag
 *   - `title:text` — (search page only) filter by title
 *   - `body:text` — (search page only) filter by body
 *   - `-exclude` — exclude term
 *   - `"phrase"` — exact phrase
 *   - `AND OR` — boolean operators (search page only)
 *
 * The finder (MiniSearch) supports project: and tag: natively. Other operators
 * are passed through as text to the backend (search page) or warned about
 * (finder).
 */

export const SEARCH_OPERATORS = [
	"project:alias",
	"tag:name",
	"title:text",
	"body:text",
	"-exclude",
	'"phrase"',
	"AND OR",
] as const;

/** Operators supported by the finder (MiniSearch index). */
export const FINDER_SUPPORTED_OPERATORS = ["project:", "tag:"] as const;

/** Operators only supported by the search page (backend FTS5). */
export const SEARCH_PAGE_ONLY_OPERATORS = ["title:", "body:", "AND", "OR"] as const;

export interface ParsedQuery {
	text: string;
	projects: string[];
	tags: string[];
	/** Terms prefixed with - to exclude. */
	excludes: string[];
	/** Quoted phrases. */
	phrases: string[];
	/** Unsupported operators found in the query. */
	unsupportedOperators: string[];
}

const stripAt = (s: string) => s.replace(/^@+/, "");
const stripHash = (s: string) => s.replace(/^#+/, "");

/**
 * Parse a query string into its components.
 * Extracts project:, tag:, -exclude, and "phrase" operators.
 * Returns the remaining text and lists of unsupported operators.
 */
export function parseQuery(query: string): ParsedQuery {
	const projects: string[] = [];
	const tags: string[] = [];
	const excludes: string[] = [];
	const phrases: string[] = [];
	const unsupportedOperators: string[] = [];
	const words: string[] = [];

	// Extract quoted phrases first
	const phraseRegex = /"([^"]+)"/g;
	let match: RegExpExecArray | null;
	let remaining = query;
	while ((match = phraseRegex.exec(query)) !== null) {
		phrases.push(match[1]);
		remaining = remaining.replace(match[0], "");
	}

	// Parse remaining tokens
	for (const tok of remaining.split(/\s+/)) {
		if (!tok) continue;
		const lower = tok.toLowerCase();

		if (lower.startsWith("project:")) {
			const v = stripAt(tok.slice("project:".length));
			if (v) projects.push(v.toLowerCase());
		} else if (lower.startsWith("tag:")) {
			const v = stripHash(tok.slice("tag:".length));
			if (v) tags.push(v.toLowerCase());
		} else if (lower.startsWith("title:") || lower.startsWith("body:")) {
			// These are search-page-only operators
			unsupportedOperators.push(tok);
			words.push(tok);
		} else if (tok === "AND" || tok === "OR") {
			// Boolean operators are search-page-only
			unsupportedOperators.push(tok);
			words.push(tok);
		} else if (tok.startsWith("-") && tok.length > 1) {
			excludes.push(tok.slice(1));
		} else {
			words.push(tok);
		}
	}

	return {
		text: words.join(" "),
		projects,
		tags,
		excludes,
		phrases,
		unsupportedOperators,
	};
}

/**
 * Check if a query contains operators not supported by the finder.
 * Returns a warning message if unsupported operators are found.
 */
export function getFinderUnsupportedWarning(query: string): string | null {
	const parsed = parseQuery(query);
	if (parsed.unsupportedOperators.length === 0) return null;

	const ops = parsed.unsupportedOperators.join(", ");
	return `Some operators are not supported in the finder: ${ops}. They work in the Search page.`;
}
