import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type * as searchModels from "../../bindings/yanta/internal/search/models";
import { Query } from "../../bindings/yanta/internal/search/service";
import { useRecentDocuments } from "../shared/hooks/useRecentDocuments";
import type { FinderItem } from "./types";

/** Merge the flat `Result[]` (one row per match) into one FinderItem per document. */
function groupResults(results: (searchModels.Result | null)[]): FinderItem[] {
	const groups = new Map<string, FinderItem>();

	for (const result of results) {
		if (!result) continue;
		const existing = groups.get(result.id);
		if (existing) {
			if (result.snippet && !existing.snippets.includes(result.snippet)) {
				existing.snippets.push(result.snippet);
				existing.matchCount += 1;
			}
			continue;
		}
		groups.set(result.id, {
			key: result.id,
			type: (result.type as "document" | "note") || "document",
			title: result.title,
			projectAlias: result.projectAlias || "",
			path: result.id,
			updated: result.updated,
			snippets: result.snippet ? [result.snippet] : [],
			matchCount: 1,
			noteId: result.noteId,
		});
	}

	return Array.from(groups.values());
}

export interface UseDocumentSearchReturn {
	query: string;
	setQuery: (query: string) => void;
	/** Search results while querying; recent documents when the query is empty. */
	items: FinderItem[];
	isLoading: boolean;
	error: string | null;
	hasQuery: boolean;
}

/**
 * Data layer for the global finder: debounced full-text search over the vault
 * with stale-response dropping (a generation counter discards results from a
 * query the user has already moved past). An empty query surfaces recent
 * documents so the finder is useful the instant it opens.
 */
export function useDocumentSearch(): UseDocumentSearchReturn {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<FinderItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { timeouts } = useMergedConfig();
	const { recentDocuments } = useRecentDocuments();
	const generationRef = useRef(0);

	const trimmed = query.trim();
	const hasQuery = trimmed.length > 0;

	useEffect(() => {
		generationRef.current += 1;
		const generation = generationRef.current;

		if (!trimmed) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		const timer = setTimeout(async () => {
			try {
				const raw = await Query(trimmed, 50, 0);
				if (generation !== generationRef.current) return;
				setResults(groupResults(Array.isArray(raw) ? raw : []));
				setError(null);
			} catch (err) {
				if (generation !== generationRef.current) return;
				setError(err instanceof Error ? err.message : "Search failed");
				setResults([]);
			} finally {
				if (generation === generationRef.current) setIsLoading(false);
			}
		}, timeouts.searchDebounceMs);

		return () => clearTimeout(timer);
	}, [trimmed, timeouts.searchDebounceMs]);

	const recentItems = useMemo<FinderItem[]>(
		() =>
			recentDocuments.map((doc) => ({
				key: doc.path,
				type: "document" as const,
				title: doc.title,
				projectAlias: doc.projectAlias,
				path: doc.path,
				updated: "",
				snippets: [],
				matchCount: 0,
				isRecent: true,
			})),
		[recentDocuments],
	);

	const items = hasQuery ? results : recentItems;

	const stableSetQuery = useCallback((next: string) => setQuery(next), []);

	return { query, setQuery: stableSetQuery, items, isLoading, error, hasQuery };
}
