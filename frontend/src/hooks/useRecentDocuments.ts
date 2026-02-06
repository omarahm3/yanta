import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useState } from "react";
import { getDocument } from "../services/DocumentService";

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
	removeRecentDocument: (path: string) => void;
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

	useEffect(() => {
		const docs = loadRecentDocuments();
		if (docs.length === 0) return;

		let cancelled = false;

		Promise.all(
			docs.map(async (doc) => {
				try {
					const fetched = await getDocument(doc.path);
					if (fetched.deletedAt) return null; // soft-deleted
				return { ...doc, title: fetched.title || doc.title };
				} catch (err) {
          console.error("[useRecentDocuments] Error fetching document:", err);
					return null;
				}
			}),
		).then((results) => {
			if (cancelled) return;
			const validated = results.filter((d): d is RecentDocument => d !== null);
			setRecentDocuments((current) => {
				if (
					validated.length === current.length &&
					validated.every((d, i) => d.path === current[i].path && d.title === current[i].title)
				) {
					return current;
				}
				saveRecentDocuments(validated);
				return validated;
			});
		});

		return () => {
			cancelled = true;
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

	const removeRecentDocument = useCallback((path: string) => {
		setRecentDocuments((current) => {
			const updated = current.filter((d) => d.path !== path);
			saveRecentDocuments(updated);
			return updated;
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

	const updateRecentDocumentTitle = useCallback((path: string, title: string) => {
		setRecentDocuments((current) => {
			const idx = current.findIndex((d) => d.path === path);
			if (idx < 0) return current;
			const updated = [...current];
			updated[idx] = { ...updated[idx], title };
			saveRecentDocuments(updated);
			return updated;
		});
	}, []);

	useEffect(() => {
		const unsubUpdated = Events.On("yanta/entry/updated", (ev) => {
			if (ev.data?.path && ev.data?.title) {
				updateRecentDocumentTitle(ev.data.path, ev.data.title);
			}
		});
		const unsubDeleted = Events.On("yanta/entry/deleted", (ev) => {
			if (ev.data?.path) {
				removeRecentDocument(ev.data.path);
			}
		});
		return () => {
			unsubUpdated();
			unsubDeleted();
		};
	}, [updateRecentDocumentTitle, removeRecentDocument]);

	return {
		recentDocuments,
		addRecentDocument,
		removeRecentDocument,
		clearRecentDocuments,
	};
}
