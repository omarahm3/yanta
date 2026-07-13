import { useCallback, useMemo, useState } from "react";
import type { Document } from "../../shared/types/Document";

export type DocumentSortField = "updated" | "created" | "title";
export type SortDirection = "asc" | "desc";

const SORT_STORAGE_KEY = "yanta:documentSort";

interface SortConfig {
	field: DocumentSortField;
	direction: SortDirection;
}

function readStoredSort(): SortConfig {
	try {
		if (typeof window === "undefined") return { field: "updated", direction: "desc" };
		const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
		if (!raw) return { field: "updated", direction: "desc" };
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed.field === "string" &&
			["updated", "created", "title"].includes(parsed.field) &&
			(parsed.direction === "asc" || parsed.direction === "desc")
		) {
			return parsed as SortConfig;
		}
	} catch {
		// ignore
	}
	return { field: "updated", direction: "desc" };
}

function writeStoredSort(config: SortConfig): void {
	try {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(config));
	} catch {
		// ignore
	}
}

export function useDocumentSort(documents: Document[]) {
	const [sort, setSortState] = useState<SortConfig>(readStoredSort);

	const setSort = useCallback((field: DocumentSortField) => {
		setSortState((prev) => {
			const next: SortConfig =
				prev.field === field
					? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
					: { field, direction: field === "title" ? "asc" : "desc" };
			writeStoredSort(next);
			return next;
		});
	}, []);

	const sortedDocuments = useMemo(() => {
		const sorted = [...documents];
		const { field, direction } = sort;
		const mult = direction === "asc" ? 1 : -1;

		sorted.sort((a, b) => {
			if (field === "title") {
				return mult * a.title.localeCompare(b.title);
			}
			const aVal = field === "created" ? a.created : a.updated;
			const bVal = field === "created" ? b.created : b.updated;
			return mult * (new Date(aVal).getTime() - new Date(bVal).getTime());
		});

		return sorted;
	}, [documents, sort]);

	return { sort, setSort, sortedDocuments };
}
