import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useState } from "react";
import { PromoteRequest } from "../../bindings/yanta/internal/journal/models";
import {
	DeleteEntry,
	GetActiveEntries,
	GetAllActiveEntries,
	PromoteToDocument,
	RestoreEntry,
} from "../../bindings/yanta/internal/journal/wailsservice";
import type { JournalEntryData } from "./JournalEntry";
import { useNotification } from "../hooks/useNotification";
import { BackendLogger } from "../utils/backendLogger";

export interface UseJournalOptions {
	projectAlias: string; // Use "all" for all projects
	date?: string;
}

export interface PromoteOptions {
	entryIds: string[];
	targetProject: string;
	title: string;
	keepOriginal: boolean;
}

export interface UseJournalReturn {
	entries: JournalEntryData[];
	isLoading: boolean;
	error: string | null;
	isEmpty: boolean;
	selectedIds: Set<string>;
	date: string;
	setDate: (date: string) => void;
	refresh: () => Promise<void>;
	deleteEntry: (id: string) => Promise<void>;
	restoreEntry: (id: string) => Promise<void>;
	promoteToDocument: (options: PromoteOptions) => Promise<string>;
	toggleSelection: (id: string) => void;
	clearSelection: () => void;
	selectAll: () => void;
}

/**
 * Hook for managing journal entries
 * Provides data fetching, selection, and operations
 */
export function useJournal({
	projectAlias,
	date: initialDate,
}: UseJournalOptions): UseJournalReturn {
	const { error: notifyError } = useNotification();
	const [entries, setEntries] = useState<JournalEntryData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [date, setDateInternal] = useState(() => initialDate || getTodayString());

	// Update date when initialDate prop changes (e.g., from navigation)
	useEffect(() => {
		if (initialDate && initialDate !== date) {
			setDateInternal(initialDate);
			setSelectedIds(new Set());
		}
	}, [initialDate]);

	// Convert backend entry to frontend format
	const mapEntry = (entry: {
		id: string;
		content: string;
		tags: string[];
		created: unknown;
		projectAlias?: string;
	}): JournalEntryData => ({
		id: entry.id,
		content: entry.content,
		tags: entry.tags || [],
		created: typeof entry.created === "string" ? entry.created : new Date().toISOString(),
		projectAlias: entry.projectAlias,
	});

	// Fetch entries
	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			if (projectAlias === "all") {
				// Fetch from all projects
				const result = await GetAllActiveEntries(date);
				const mappedEntries = (result || []).map(mapEntry);
				setEntries(mappedEntries);
			} else {
				// Fetch from specific project
				const result = await GetActiveEntries(projectAlias, date);
				const mappedEntries = (result || []).map(mapEntry);
				setEntries(mappedEntries);
			}
		} catch (err) {
			BackendLogger.error("Failed to fetch journal entries:", err);
			setError("Failed to load entries");
			setEntries([]);
			notifyError("Failed to load journal entries");
		} finally {
			setIsLoading(false);
		}
	}, [projectAlias, date, notifyError]);

	// Fetch on mount and when dependencies change
	useEffect(() => {
		refresh();
	}, [refresh]);

	// Subscribe to journal entry events for real-time updates
	useEffect(() => {
		const unsubscribeCreated = Events.On("yanta/entry/created", (ev) => {
			if (ev.data?.type === "journal") {
				if (projectAlias === "all" || (ev.data.projectId === projectAlias && ev.data.date === date)) {
					refresh();
				}
			}
		});

		const unsubscribeDeleted = Events.On("yanta/entry/deleted", (ev) => {
			if (ev.data?.type === "journal") {
				if (projectAlias === "all" || (ev.data.projectId === projectAlias && ev.data.date === date)) {
					refresh();
				}
			}
		});

		const unsubscribeRestored = Events.On("yanta/entry/restored", (ev) => {
			if (ev.data?.type === "journal") {
				if (projectAlias === "all" || (ev.data.projectId === projectAlias && ev.data.date === date)) {
					refresh();
				}
			}
		});

		return () => {
			unsubscribeCreated();
			unsubscribeDeleted();
			unsubscribeRestored();
		};
	}, [projectAlias, date, refresh]);

	// Update date and trigger refresh
	const setDate = useCallback((newDate: string) => {
		setDateInternal(newDate);
		setSelectedIds(new Set()); // Clear selection on date change
	}, []);

	// Delete entry
	const deleteEntry = useCallback(
		async (id: string) => {
			try {
				await DeleteEntry(projectAlias, date, id);
				// Optimistically remove from list
				setEntries((prev) => prev.filter((e) => e.id !== id));
				setSelectedIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			} catch (err) {
				BackendLogger.error("Failed to delete entry:", err);
				throw err;
			}
		},
		[projectAlias, date],
	);

	// Restore entry
	const restoreEntry = useCallback(
		async (id: string) => {
			try {
				await RestoreEntry(projectAlias, date, id);
				await refresh();
			} catch (err) {
				BackendLogger.error("Failed to restore entry:", err);
				throw err;
			}
		},
		[projectAlias, date, refresh],
	);

	// Promote to document
	const promoteToDocument = useCallback(
		async (options: PromoteOptions): Promise<string> => {
			const request = new PromoteRequest({
				sourceProject: projectAlias,
				date,
				entryIds: options.entryIds,
				targetProject: options.targetProject,
				title: options.title,
				keepOriginal: options.keepOriginal,
			});

			const documentPath = await PromoteToDocument(request);

			// If not keeping original, remove from list
			if (!options.keepOriginal) {
				setEntries((prev) => prev.filter((e) => !options.entryIds.includes(e.id)));
				setSelectedIds(new Set());
			}

			return documentPath;
		},
		[projectAlias, date],
	);

	// Selection management
	const toggleSelection = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	const selectAll = useCallback(() => {
		setSelectedIds(new Set(entries.map((e) => e.id)));
	}, [entries]);

	return {
		entries,
		isLoading,
		error,
		isEmpty: !isLoading && entries.length === 0,
		selectedIds,
		date,
		setDate,
		refresh,
		deleteEntry,
		restoreEntry,
		promoteToDocument,
		toggleSelection,
		clearSelection,
		selectAll,
	};
}

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayString(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
