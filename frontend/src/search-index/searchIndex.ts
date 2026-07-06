import MiniSearch from "minisearch";
import type { IndexDoc } from "../../bindings/yanta/internal/search/models";

/**
 * MiniSearch configuration for the in-memory vault index. The indexed fields
 * mirror the plain text the backend already extracts (title/headings/body/code
 * for documents, content+tags for notes — see search.ExportIndex). Title and
 * headings are boosted so a name match outranks one buried in the body.
 *
 * Search options give the Omnisearch/Zed-style feel:
 *  - `prefix` on every term so results appear as you type ("syste" → system),
 *  - `fuzzy` (edit distance) on longer terms so typos still match ("sytem"),
 *  - `combineWith: AND` so extra words narrow the results (matches the old
 *    FTS5 query builder, which AND-joined terms).
 */
export function createMiniSearch(): MiniSearch<IndexDoc> {
	return new MiniSearch<IndexDoc>({
		idField: "id",
		fields: ["title", "headings", "body", "code", "tags"],
		searchOptions: {
			boost: { title: 3, headings: 2, tags: 2 },
			combineWith: "AND",
			prefix: true,
			// Skip fuzzy on 1–3 char terms — edit distance there is just noise.
			fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
		},
	});
}
