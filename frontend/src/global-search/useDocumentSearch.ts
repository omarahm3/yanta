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
	/** Index is rebuilding — results are still searchable but may be stale. */
	isUpdating: boolean;
	/** Index is in error state — offer rebuild. */
	isError: boolean;
	/** Trigger a rebuild of the search index. */
	rebuild: () => Promise<void>;
	/** Retry loading recent documents (for the empty-query state). */
	retryRecent: () => void;
	/** Recent-documents load failed — surface inline. */
	recentError: string | null;
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
	const [recentError, setRecentError] = useState<string | null>(null);
	const [recentRetryKey, setRecentRetryKey] = useState(0);

	const status = useSearchIndexStore((s) => s.status);
	const search = useSearchIndexStore((s) => s.search);
	const build = useSearchIndexStore((s) => s.build);

	const trimmed = query.trim();
	const hasQuery = trimmed.length > 0;

	useEffect(() => {
		let cancelled = false;
		setRecentError(null);
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
			} catch (err) {
				if (cancelled) return;
				setRecentError(err instanceof Error ? err.message : "Failed to load recent documents");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [recentRetryKey]);

	// Synchronous in-memory search. `status` is a dependency so results fill in
	// automatically once the index finishes (re)building — no keystroke needed.
	const results = useMemo<FinderItem[]>(() => {
		if (!hasQuery) return [];
		return search(trimmed);
	}, [trimmed, hasQuery, search, status]);

	const items = hasQuery ? results : recentItems;
	const isError = status === "error";
	const isUpdating = status === "building";
	const isLoading = hasQuery && status === "idle";
	const error = isError ? "Search index unavailable." : null;

	const stableSetQuery = useCallback((next: string) => setQuery(next), []);
	const stableRebuild = useCallback(() => build(), [build]);
	const retryRecent = useCallback(() => setRecentRetryKey((k) => k + 1), []);

	return {
		query,
		setQuery: stableSetQuery,
		items,
		isLoading,
		error,
		hasQuery,
		isUpdating,
		isError,
		rebuild: stableRebuild,
		retryRecent,
		recentError,
	};
}
