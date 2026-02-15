import { Events } from "@wailsio/runtime";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { getDocument } from "../services/DocumentService";
import { BackendLogger } from "../utils/backendLogger";

const STORAGE_KEY = "yanta_recent_documents";
const MAX_RECENT_DOCUMENTS = 10;

export interface RecentDocument {
	path: string;
	title: string;
	projectAlias: string;
	lastOpened: number;
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

interface RecentDocumentsState {
	documents: RecentDocument[];
	addRecentDocument: (doc: Omit<RecentDocument, "lastOpened">) => void;
	removeRecentDocument: (path: string) => void;
	clearRecentDocuments: () => void;
	updateRecentDocumentTitle: (path: string, title: string) => void;
	setDocuments: (docs: RecentDocument[]) => void;
}

function areRecentDocumentsEqual(a: RecentDocument[], b: RecentDocument[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (
			a[i].path !== b[i].path ||
			a[i].title !== b[i].title ||
			a[i].projectAlias !== b[i].projectAlias ||
			a[i].lastOpened !== b[i].lastOpened
		) {
			return false;
		}
	}
	return true;
}

function parseStoredDocuments(raw: string): RecentDocument[] | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"version" in parsed &&
			parsed.version === 1 &&
			"documents" in parsed
		) {
			return validateRecentDocuments(parsed.documents);
		}
		// Legacy format: raw array
		if (Array.isArray(parsed)) {
			return validateRecentDocuments(parsed);
		}
		return null;
	} catch {
		return null;
	}
}

const recentDocumentsStorage: PersistStorage<{ documents: RecentDocument[] }> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const documents = parseStoredDocuments(raw);
			return documents !== null ? { state: { documents } } : null;
		} catch (err) {
			BackendLogger.error("[recentDocuments.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { documents: RecentDocument[] } }) => {
		try {
			if (value.state.documents.length === 0) {
				localStorage.removeItem(name);
			} else {
				localStorage.setItem(name, JSON.stringify({ version: 1, documents: value.state.documents }));
			}
		} catch (err) {
			BackendLogger.error("[recentDocuments.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[recentDocuments.store] Failed to clear:", err);
		}
	},
};

export const useRecentDocumentsStore = create<RecentDocumentsState>()(
	persist(
		(set) => ({
			documents: [],
			addRecentDocument: (doc) => {
				const newDoc: RecentDocument = {
					...doc,
					lastOpened: Date.now(),
				};
				set((state) => {
					const existingIndex = state.documents.findIndex((d) => d.path === doc.path);
					const updated =
						existingIndex >= 0
							? [newDoc, ...state.documents.filter((_, i) => i !== existingIndex)]
							: [newDoc, ...state.documents];
					return { documents: updated.slice(0, MAX_RECENT_DOCUMENTS) };
				});
			},
			removeRecentDocument: (path) => {
				set((state) => ({
					documents: state.documents.filter((d) => d.path !== path),
				}));
			},
			clearRecentDocuments: () => {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (err) {
					BackendLogger.error("[recentDocuments.store] Failed to clear localStorage:", err);
				}
				set({ documents: [] });
			},
			updateRecentDocumentTitle: (path, title) => {
				set((state) => {
					const idx = state.documents.findIndex((d) => d.path === path);
					if (idx < 0) return state;
					if (state.documents[idx].title === title) return state;
					const updated = [...state.documents];
					updated[idx] = { ...updated[idx], title };
					return { documents: updated };
				});
			},
			setDocuments: (docs) => set({ documents: docs }),
		}),
		{
			name: STORAGE_KEY,
			storage: recentDocumentsStorage,
			partialize: (s) => ({ documents: s.documents }),
		},
	),
);

export interface UseRecentDocumentsReturn {
	recentDocuments: RecentDocument[];
	addRecentDocument: (doc: Omit<RecentDocument, "lastOpened">) => void;
	removeRecentDocument: (path: string) => void;
	clearRecentDocuments: () => void;
}

export function useRecentDocuments(): UseRecentDocumentsReturn {
	const documents = useRecentDocumentsStore((s) => s.documents);
	const addRecentDocument = useRecentDocumentsStore((s) => s.addRecentDocument);
	const removeRecentDocument = useRecentDocumentsStore((s) => s.removeRecentDocument);
	const clearRecentDocuments = useRecentDocumentsStore((s) => s.clearRecentDocuments);
	const updateRecentDocumentTitle = useRecentDocumentsStore((s) => s.updateRecentDocumentTitle);
	const setDocuments = useRecentDocumentsStore((s) => s.setDocuments);
	const documentsPathSignature = useMemo(() => documents.map((d) => d.path).join("|"), [documents]);

	// Cross-tab sync + event subscriptions: single effect for external listeners
	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				useRecentDocumentsStore.persist?.rehydrate();
			}
		};
		window.addEventListener("storage", handleStorage);
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
			window.removeEventListener("storage", handleStorage);
			unsubUpdated();
			unsubDeleted();
		};
	}, [updateRecentDocumentTitle, removeRecentDocument]);

	// Fetch fresh titles for stored documents and persist to store
	useEffect(() => {
		if (documents.length === 0) return;

		let cancelled = false;

		Promise.all(
			documents.map(async (doc) => {
				try {
					const fetched = await getDocument(doc.path);
					if (fetched.deletedAt) return null;
					return { ...doc, title: fetched.title || doc.title };
				} catch (err) {
					BackendLogger.error("[useRecentDocuments] Error fetching document:", err);
					return null;
				}
			}),
		).then((results) => {
			if (cancelled) return;
			const validated = results.filter((d): d is RecentDocument => d !== null);
			if (areRecentDocumentsEqual(validated, documents)) {
				return;
			}
			setDocuments(validated);
		});

		return () => {
			cancelled = true;
		};
	}, [documentsPathSignature, setDocuments]);

	return useMemo<UseRecentDocumentsReturn>(
		() => ({
			recentDocuments: documents,
			addRecentDocument,
			removeRecentDocument,
			clearRecentDocuments,
		}),
		[documents, addRecentDocument, removeRecentDocument, clearRecentDocuments],
	);
}
