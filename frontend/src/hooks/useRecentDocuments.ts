import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDocument } from "../services/DocumentService";
import { useLocalStorage } from "./useLocalStorage";

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

function validateRecentDocuments(data: unknown): RecentDocument[] | null {
	if (!Array.isArray(data)) {
		return null;
	}
	return data.filter(
		(doc): doc is RecentDocument =>
			typeof doc === "object" &&
			doc !== null &&
			typeof doc.path === "string" &&
			typeof doc.title === "string" &&
			typeof doc.projectAlias === "string" &&
			typeof doc.lastOpened === "number",
	);
}

export function useRecentDocuments(): UseRecentDocumentsReturn {
	const [storedDocuments, setStoredDocuments] = useLocalStorage<RecentDocument[]>(
		STORAGE_KEY,
		[],
		{
			validate: validateRecentDocuments,
			onError: (operation, err) => {
				console.error(`[useRecentDocuments] Failed to ${operation}:`, err);
			},
		},
	);
	const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>(storedDocuments);

	useEffect(() => {
		if (storedDocuments.length === 0) return;

		let cancelled = false;

		Promise.all(
			storedDocuments.map(async (doc) => {
				try {
					const fetched = await getDocument(doc.path);
					if (fetched.deletedAt) return null;
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
				setStoredDocuments(validated);
				return validated;
			});
		});

		return () => {
			cancelled = true;
		};
	}, [storedDocuments, setStoredDocuments]);

	const addRecentDocument = useCallback(
		(doc: Omit<RecentDocument, "lastOpened">) => {
			const newDoc: RecentDocument = {
				...doc,
				lastOpened: Date.now(),
			};

			setStoredDocuments((current) => {
				const existingIndex = current.findIndex((d) => d.path === doc.path);
				let updated: RecentDocument[];
				if (existingIndex >= 0) {
					updated = [newDoc, ...current.filter((_, i) => i !== existingIndex)];
				} else {
					updated = [newDoc, ...current];
				}
				return updated.slice(0, MAX_RECENT_DOCUMENTS);
			});

			setRecentDocuments((current) => {
				const existingIndex = current.findIndex((d) => d.path === doc.path);
				let updated: RecentDocument[];
				if (existingIndex >= 0) {
					updated = [newDoc, ...current.filter((_, i) => i !== existingIndex)];
				} else {
					updated = [newDoc, ...current];
				}
				return updated.slice(0, MAX_RECENT_DOCUMENTS);
			});
		},
		[setStoredDocuments],
	);

	const removeRecentDocument = useCallback(
		(path: string) => {
			setStoredDocuments((current) => current.filter((d) => d.path !== path));
			setRecentDocuments((current) => current.filter((d) => d.path !== path));
		},
		[setStoredDocuments],
	);

	const clearRecentDocuments = useCallback(() => {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			console.error("[useRecentDocuments] Failed to clear localStorage:", err);
		}
		setStoredDocuments([]);
		setRecentDocuments([]);
	}, [setStoredDocuments]);

	const updateRecentDocumentTitle = useCallback(
		(path: string, title: string) => {
			setStoredDocuments((current) => {
				const idx = current.findIndex((d) => d.path === path);
				if (idx < 0) return current;
				const updated = [...current];
				updated[idx] = { ...updated[idx], title };
				return updated;
			});
			setRecentDocuments((current) => {
				const idx = current.findIndex((d) => d.path === path);
				if (idx < 0) return current;
				const updated = [...current];
				updated[idx] = { ...updated[idx], title };
				return updated;
			});
		},
		[setStoredDocuments],
	);

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

	return useMemo<UseRecentDocumentsReturn>(
		() => ({
			recentDocuments,
			addRecentDocument,
			removeRecentDocument,
			clearRecentDocuments,
		}),
		[recentDocuments, addRecentDocument, removeRecentDocument, clearRecentDocuments],
	);
}
