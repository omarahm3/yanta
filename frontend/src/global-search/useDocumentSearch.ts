import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchIndexStore } from "../search-index/searchIndex.store";
import { listRecentDocuments } from "../shared/services/DocumentService";
import type { FinderItem } from "./types";

export interface UseDocumentSearchReturn {
	query: string;
	setQuery: (query: string) => void;
	/** Search results while querying; recent vault documents when the query is empty. */
	items: FinderItem[];
	isLoading: boolean;
	error: string | null;
	hasQuery: boolean;
}

/**
 * Data layer for the global finder. Matching runs entirely against an in-memory
 * MiniSearch index of the vault's content (see searchIndex.store) — prefix +
 * typo-tolerant fuzzy full-text search with zero backend round-trips, so results
 * update instantly as you type. An empty query surfaces the most recently
 * modified documents so the finder is useful the moment it opens.
 */
export function useDocumentSearch(): UseDocumentSearchReturn {
	const [query, setQuery] = useState("");
	const [recentItems, setRecentItems] = useState<FinderItem[]>([]);

	const status = useSearchIndexStore((s) => s.status);
	const search = useSearchIndexStore((s) => s.search);

	const trimmed = query.trim();
	const hasQuery = trimmed.length > 0;

	// Load recent documents once for the empty-query state (a separate backend
	// call so it also lists documents not opened this session).
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const docs = await listRecentDocuments(50);
				if (cancelled) return;
				setRecentItems(
					docs.map((doc) => ({
						key: doc.path,
						type: "document" as const,
						title: doc.title,
						projectAlias: doc.projectAlias,
						path: doc.path,
						updated: doc.updated.toISOString(),
						snippets: [],
						matchCount: 0,
						isRecent: true,
					})),
				);
			} catch {
				// Recent list is best-effort; typed search still works independently.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Synchronous in-memory search. `status` is a dependency so results fill in
	// automatically once the index finishes (re)building — no keystroke needed.
	const results = useMemo<FinderItem[]>(() => {
		if (!hasQuery) return [];
		return search(trimmed);
	}, [trimmed, hasQuery, search, status]);

	const items = hasQuery ? results : recentItems;
	const isLoading = hasQuery && status !== "ready" && status !== "error";
	const error = status === "error" ? "Search index unavailable — try reopening the app." : null;

	const stableSetQuery = useCallback((next: string) => setQuery(next), []);

	return { query, setQuery: stableSetQuery, items, isLoading, error, hasQuery };
}
