const RADIUS = 70;
const HEAD_FALLBACK = 180;

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build one highlighted excerpt from `text`, centred on the first matched term.
 * The result is fully HTML-escaped with only `<mark>` tags injected around
 * matches — upholding the trusted-content contract the finder's note preview
 * relies on (it renders snippets via dangerouslySetInnerHTML). This replaces the
 * backend FTS5 `snippet()` now that matching happens client-side.
 *
 * `terms` are the matched index terms MiniSearch returns (the actual words
 * present in the document), so highlighting them marks real occurrences even
 * when the query was a prefix or a typo.
 */
export function buildSnippet(text: string, terms: string[]): string {
	const clean = text.replace(/\s+/g, " ").trim();
	if (!clean) return "";

	const lower = clean.toLowerCase();
	let pos = -1;
	for (const term of terms) {
		if (!term) continue;
		const i = lower.indexOf(term.toLowerCase());
		if (i !== -1 && (pos === -1 || i < pos)) pos = i;
	}

	let start = 0;
	let end = Math.min(clean.length, HEAD_FALLBACK);
	if (pos !== -1) {
		start = Math.max(0, pos - RADIUS);
		end = Math.min(clean.length, pos + RADIUS * 2);
	}

	const excerpt = clean.slice(start, end);
	const prefix = start > 0 ? "… " : "";
	const suffix = end < clean.length ? " …" : "";

	let html = escapeHtml(excerpt);
	const seen = new Set<string>();
	for (const term of terms) {
		const t = term.trim();
		if (t.length < 2 || seen.has(t.toLowerCase())) continue;
		seen.add(t.toLowerCase());
		const re = new RegExp(escapeRegExp(escapeHtml(t)), "gi");
		html = html.replace(re, (m) => `<mark>${m}</mark>`);
	}

	return prefix + html + suffix;
}
