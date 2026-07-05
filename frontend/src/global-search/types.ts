/** A single row in the finder — one document or note, de-duplicated by key. */
export interface FinderItem {
	/** Stable unique id: document path, or the journal result id. */
	key: string;
	type: "document" | "note";
	title: string;
	projectAlias: string;
	/** Document path (documents & recent); the journal id string for notes. */
	path: string;
	/** Document: updated_at. Note: the entry date (YYYY-MM-DD) used to open it. */
	updated: string;
	/** Highlighted `<mark>` snippets from search; empty for recent documents. */
	snippets: string[];
	matchCount: number;
	/** Journal entry id — only present for notes. */
	noteId?: string;
	/** True when surfaced from the recent-documents list (empty query). */
	isRecent?: boolean;
}
