import { useCallback, useEffect, useState } from "react";

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

function loadProgressData(): UserProgressData {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return getDefaultProgressData();
		}
		const parsed = JSON.parse(stored);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return getDefaultProgressData();
		}
		// Validate and merge with defaults for forward compatibility
		return {
			documentsCreated: typeof parsed.documentsCreated === "number" ? parsed.documentsCreated : 0,
			journalEntriesCreated:
				typeof parsed.journalEntriesCreated === "number" ? parsed.journalEntriesCreated : 0,
			projectsSwitched: typeof parsed.projectsSwitched === "number" ? parsed.projectsSwitched : 0,
			hintsShown: Array.isArray(parsed.hintsShown) ? parsed.hintsShown : [],
		};
	} catch {
		return getDefaultProgressData();
	}
}

function saveProgressData(data: UserProgressData): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (err) {
		console.error("[useUserProgress] Failed to save to localStorage:", err);
	}
}

function clearProgressData(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (err) {
		console.error("[useUserProgress] Failed to clear localStorage:", err);
	}
}

export function useUserProgress(): UseUserProgressReturn {
	const [progressData, setProgressData] = useState<UserProgressData>(() => loadProgressData());

	// Sync with other tabs via storage events
	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				setProgressData(loadProgressData());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	const incrementDocumentsCreated = useCallback(() => {
		setProgressData((prev) => {
			const updated = {
				...prev,
				documentsCreated: prev.documentsCreated + 1,
			};
			saveProgressData(updated);
			return updated;
		});
	}, []);

	const incrementJournalEntriesCreated = useCallback(() => {
		setProgressData((prev) => {
			const updated = {
				...prev,
				journalEntriesCreated: prev.journalEntriesCreated + 1,
			};
			saveProgressData(updated);
			return updated;
		});
	}, []);

	const incrementProjectsSwitched = useCallback(() => {
		setProgressData((prev) => {
			const updated = {
				...prev,
				projectsSwitched: prev.projectsSwitched + 1,
			};
			saveProgressData(updated);
			return updated;
		});
	}, []);

	const markHintShown = useCallback((hintId: string) => {
		setProgressData((prev) => {
			if (prev.hintsShown.includes(hintId)) {
				return prev;
			}
			const updated = {
				...prev,
				hintsShown: [...prev.hintsShown, hintId],
			};
			saveProgressData(updated);
			return updated;
		});
	}, []);

	const hasHintBeenShown = useCallback(
		(hintId: string): boolean => {
			return progressData.hintsShown.includes(hintId);
		},
		[progressData.hintsShown],
	);

	const resetProgress = useCallback(() => {
		clearProgressData();
		setProgressData(getDefaultProgressData());
	}, []);

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
