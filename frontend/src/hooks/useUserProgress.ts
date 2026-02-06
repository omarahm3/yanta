import { useCallback, useMemo } from "react";
import { BackendLogger } from "../utils/backendLogger";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";

const STORAGE_KEY = "yanta_user_progress";

export interface UserProgressData {
	documentsCreated: number;
	journalEntriesCreated: number;
	projectsSwitched: number;
	hintsShown: string[];
}

export interface UseUserProgressReturn {
	progressData: UserProgressData;
	incrementDocumentsCreated: () => void;
	incrementJournalEntriesCreated: () => void;
	incrementProjectsSwitched: () => void;
	markHintShown: (hintId: string) => void;
	hasHintBeenShown: (hintId: string) => boolean;
	resetProgress: () => void;
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

export function useUserProgress(): UseUserProgressReturn {
	const [progressData, setProgressData] = useLocalStorage<UserProgressData>(
		STORAGE_KEY,
		getDefaultProgressData(),
		{
			validate: validateProgressData,
			onError: (operation, err) => {
				BackendLogger.error(`[useUserProgress] Failed to ${operation}:`, err);
			},
		},
	);

	const incrementDocumentsCreated = useCallback(() => {
		setProgressData((prev) => ({
			...prev,
			documentsCreated: prev.documentsCreated + 1,
		}));
	}, [setProgressData]);

	const incrementJournalEntriesCreated = useCallback(() => {
		setProgressData((prev) => ({
			...prev,
			journalEntriesCreated: prev.journalEntriesCreated + 1,
		}));
	}, [setProgressData]);

	const incrementProjectsSwitched = useCallback(() => {
		setProgressData((prev) => ({
			...prev,
			projectsSwitched: prev.projectsSwitched + 1,
		}));
	}, [setProgressData]);

	const markHintShown = useCallback(
		(hintId: string) => {
			setProgressData((prev) => {
				if (prev.hintsShown.includes(hintId)) {
					return prev;
				}
				return {
					...prev,
					hintsShown: [...prev.hintsShown, hintId],
				};
			});
		},
		[setProgressData],
	);

	const hasHintBeenShown = useCallback(
		(hintId: string): boolean => {
			return progressData.hintsShown.includes(hintId);
		},
		[progressData.hintsShown],
	);

	const resetProgress = useCallback(() => {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			BackendLogger.error("[useUserProgress] Failed to clear localStorage:", err);
		}
		setProgressData(getDefaultProgressData());
	}, [setProgressData]);

	return useMemo<UseUserProgressReturn>(
		() => ({
			progressData,
			incrementDocumentsCreated,
			incrementJournalEntriesCreated,
			incrementProjectsSwitched,
			markHintShown,
			hasHintBeenShown,
			resetProgress,
		}),
		[
			progressData,
			incrementDocumentsCreated,
			incrementJournalEntriesCreated,
			incrementProjectsSwitched,
			markHintShown,
			hasHintBeenShown,
			resetProgress,
		],
	);
}
