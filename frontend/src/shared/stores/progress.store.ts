import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../../utils/backendLogger";

const STORAGE_KEY = "yanta_user_progress";

export interface UserProgressData {
	documentsCreated: number;
	journalEntriesCreated: number;
	projectsSwitched: number;
	hintsShown: string[];
}

function getDefaultProgressData(): UserProgressData {
	return {
		documentsCreated: 0,
		journalEntriesCreated: 0,
		projectsSwitched: 0,
		hintsShown: [],
	};
}

function validateProgressData(data: unknown): UserProgressData | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	const parsed = data as Record<string, unknown>;
	return {
		documentsCreated: typeof parsed.documentsCreated === "number" ? parsed.documentsCreated : 0,
		journalEntriesCreated:
			typeof parsed.journalEntriesCreated === "number" ? parsed.journalEntriesCreated : 0,
		projectsSwitched: typeof parsed.projectsSwitched === "number" ? parsed.projectsSwitched : 0,
		hintsShown: Array.isArray(parsed.hintsShown) ? parsed.hintsShown : [],
	};
}

interface ProgressState extends UserProgressData {
	incrementDocumentsCreated: () => void;
	incrementJournalEntriesCreated: () => void;
	incrementProjectsSwitched: () => void;
	markHintShown: (hintId: string) => void;
	hasHintBeenShown: (hintId: string) => boolean;
	resetProgress: () => void;
}

/** Persist storage that validates on getItem; returns null to use initial state if invalid. */
const progressStorage: PersistStorage<UserProgressData> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const state = validateProgressData(parsed);
			return state !== null ? { state } : null;
		} catch (err) {
			BackendLogger.error("[progress.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: UserProgressData }) => {
		try {
			localStorage.setItem(name, JSON.stringify(value));
		} catch (err) {
			BackendLogger.error("[progress.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[progress.store] Failed to clear:", err);
		}
	},
};

export const useProgressStore = create<ProgressState>()(
	persist(
		(set, get) => ({
			...getDefaultProgressData(),
			incrementDocumentsCreated: () => set((s) => ({ documentsCreated: s.documentsCreated + 1 })),
			incrementJournalEntriesCreated: () =>
				set((s) => ({ journalEntriesCreated: s.journalEntriesCreated + 1 })),
			incrementProjectsSwitched: () => set((s) => ({ projectsSwitched: s.projectsSwitched + 1 })),
			markHintShown: (hintId) =>
				set((s) => {
					if (s.hintsShown.includes(hintId)) return s;
					return { hintsShown: [...s.hintsShown, hintId] };
				}),
			hasHintBeenShown: (hintId) => get().hintsShown.includes(hintId),
			resetProgress: () => {
				try {
					localStorage.removeItem(STORAGE_KEY);
				} catch (err) {
					BackendLogger.error("[progress.store] Failed to clear localStorage:", err);
				}
				set(getDefaultProgressData());
			},
		}),
		{
			name: STORAGE_KEY,
			storage: progressStorage,
			partialize: (s) => ({
				documentsCreated: s.documentsCreated,
				journalEntriesCreated: s.journalEntriesCreated,
				projectsSwitched: s.projectsSwitched,
				hintsShown: s.hintsShown,
			}),
		},
	),
);

export interface UseUserProgressReturn {
	progressData: UserProgressData;
	incrementDocumentsCreated: () => void;
	incrementJournalEntriesCreated: () => void;
	incrementProjectsSwitched: () => void;
	markHintShown: (hintId: string) => void;
	hasHintBeenShown: (hintId: string) => boolean;
	resetProgress: () => void;
}

/** Same API as legacy useUserProgressContext — use in components. */
export function useUserProgressContext(): UseUserProgressReturn {
	const progressData: UserProgressData = {
		documentsCreated: useProgressStore((s) => s.documentsCreated),
		journalEntriesCreated: useProgressStore((s) => s.journalEntriesCreated),
		projectsSwitched: useProgressStore((s) => s.projectsSwitched),
		hintsShown: useProgressStore((s) => s.hintsShown),
	};
	const incrementDocumentsCreated = useProgressStore((s) => s.incrementDocumentsCreated);
	const incrementJournalEntriesCreated = useProgressStore((s) => s.incrementJournalEntriesCreated);
	const incrementProjectsSwitched = useProgressStore((s) => s.incrementProjectsSwitched);
	const markHintShown = useProgressStore((s) => s.markHintShown);
	const hasHintBeenShown = useProgressStore((s) => s.hasHintBeenShown);
	const resetProgress = useProgressStore((s) => s.resetProgress);
	return {
		progressData,
		incrementDocumentsCreated,
		incrementJournalEntriesCreated,
		incrementProjectsSwitched,
		markHintShown,
		hasHintBeenShown,
		resetProgress,
	};
}
