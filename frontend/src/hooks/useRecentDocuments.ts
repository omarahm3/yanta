import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "yanta_recent_documents";
const MAX_RECENT_DOCUMENTS = 10;

export interface RecentDocument {
	path: string;
	title: string;
	projectAlias: string;
	lastOpened: number;
}

export interface UseRecentDocumentsReturn {
	recentDocuments: RecentDocument[];
	addRecentDocument: (doc: Omit<RecentDocument, "lastOpened">) => void;
	clearRecentDocuments: () => void;
}

function loadRecentDocuments(): RecentDocument[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return [];
		}
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(
			(doc): doc is RecentDocument =>
				typeof doc === "object" &&
				doc !== null &&
				typeof doc.path === "string" &&
				typeof doc.title === "string" &&
				typeof doc.projectAlias === "string" &&
				typeof doc.lastOpened === "number",
		);
	} catch {
		return [];
	}
}

function saveRecentDocuments(documents: RecentDocument[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
	} catch (err) {
		console.error("[useRecentDocuments] Failed to save to localStorage:", err);
	}
}

export function useRecentDocuments(): UseRecentDocumentsReturn {
	const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>(() =>
		loadRecentDocuments(),
	);

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				setRecentDocuments(loadRecentDocuments());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	const addRecentDocument = useCallback((doc: Omit<RecentDocument, "lastOpened">) => {
		setRecentDocuments((current) => {
			const existingIndex = current.findIndex((d) => d.path === doc.path);

			const newDoc: RecentDocument = {
				...doc,
				lastOpened: Date.now(),
			};

			let updated: RecentDocument[];
			if (existingIndex >= 0) {
				updated = [newDoc, ...current.filter((_, i) => i !== existingIndex)];
			} else {
				updated = [newDoc, ...current];
			}

			const trimmed = updated.slice(0, MAX_RECENT_DOCUMENTS);
			saveRecentDocuments(trimmed);
			return trimmed;
		});
	}, []);

	const clearRecentDocuments = useCallback(() => {
		setRecentDocuments([]);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			console.error("[useRecentDocuments] Failed to clear localStorage:", err);
		}
	}, []);

	return {
		recentDocuments,
		addRecentDocument,
		clearRecentDocuments,
	};
}
