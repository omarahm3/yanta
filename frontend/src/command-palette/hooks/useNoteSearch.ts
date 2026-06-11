import { useCallback, useEffect, useRef, useState } from "react";
import type * as searchModels from "../../../bindings/yanta/internal/search/models";
import { Query } from "../../../bindings/yanta/internal/search/service";

export interface NoteSearchResult {
	path: string;
	title: string;
	projectAlias: string;
	type: "document" | "note";
	noteId?: string;
}

/**
 * Debounced note title search for the quick-switcher.
 * Uses `title:` prefix for fast, title-only FTS queries.
 */
export function useNoteSearch(query: string, debounceMs = 150) {
	const [results, setResults] = useState<NoteSearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const genRef = useRef(0);

	const search = useCallback(async (q: string, gen: number) => {
		setIsSearching(true);
		try {
			const raw = await Query(`title:${q}`, 10, 0);
			if (gen !== genRef.current) return;
			const items = (raw ?? [])
				.filter((r): r is searchModels.Result => r !== null)
				.map((r) => ({
					path: r.id,
					title: r.title || "Untitled",
					projectAlias: r.projectAlias || "",
					type: (r.type as "document" | "note") || "document",
					noteId: r.noteId,
				}));
			setResults(items);
		} catch {
			if (gen !== genRef.current) return;
			setResults([]);
		} finally {
			if (gen === genRef.current) setIsSearching(false);
		}
	}, []);

	useEffect(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		genRef.current += 1;
		const gen = genRef.current;

		if (!query.trim()) {
			setResults([]);
			setIsSearching(false);
			return;
		}

		timerRef.current = setTimeout(() => {
			search(query, gen);
		}, debounceMs);

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [query, debounceMs, search]);

	return { results, isSearching };
}
