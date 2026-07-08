import { useCallback, useEffect, useRef, useState } from "react";
import { useMergedConfig } from "@/shared/stores/preferences.store";
import { useSaveErrorStore } from "@/shared/stores/saveError.store";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface RegisteredSaver {
	save: () => Promise<void>;
	isDirty: () => boolean;
}

const activeSavers = new Set<RegisteredSaver>();

export function registerSaver(save: () => Promise<void>, isDirty: () => boolean): () => void {
	const saver: RegisteredSaver = { save, isDirty };
	activeSavers.add(saver);
	return () => {
		activeSavers.delete(saver);
	};
}

/** Flush only editors that actually have unsaved changes (used on quit). */
export async function flushAllDirty(): Promise<void> {
	const savers = Array.from(activeSavers).filter((s) => s.isDirty());
	await Promise.all(savers.map((s) => s.save().catch(() => {})));
}

interface AutoSaveConfig<T> {
	value: T;
	onSave: () => Promise<void>;
	delay?: number;
	enabled?: boolean;
	saveOnBlur?: boolean;
	isInitialized?: boolean;
	/** When set, used for change detection instead of JSON.stringify(value). Caller can pass a cheap key (e.g. content hash) to avoid serializing large values in the hot path. */
	compareKey?: string;
}

interface AutoSaveReturn {
	saveState: SaveState;
	lastSaved: Date | null;
	saveError: Error | null;
	saveNow: () => Promise<void>;
	hasUnsavedChanges: boolean;
}

export const useAutoSave = <T>({
	value,
	onSave,
	delay: delayProp,
	enabled = true,
	saveOnBlur = true,
	isInitialized = true,
	compareKey,
}: AutoSaveConfig<T>): AutoSaveReturn => {
	const { timeouts } = useMergedConfig();
	const delay = delayProp ?? timeouts.autoSaveDebounceMs;
	const timeoutsRef = useRef(timeouts);
	timeoutsRef.current = timeouts;

	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [saveError, setSaveError] = useState<Error | null>(null);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	const timeoutRef = useRef<number | null>(null);
	const retryCountRef = useRef(0);
	const isSavingRef = useRef(false);
	const lastValueRef = useRef<T>(value);
	const lastSavedValueRef = useRef<T>(value);
	const initialValueRef = useRef<T>(value);
	const currentKeyRef = useRef<string>("");
	const lastSavedKeyRef = useRef<string>("");
	const initialKeyRef = useRef<string>("");
	const hasUserMadeChangesRef = useRef(false);
	const savedStateTimeoutRef = useRef<number | null>(null);
	const retryTimeoutRef = useRef<number | null>(null);
	const onSaveRef = useRef(onSave);
	const prevIsInitializedRef = useRef(isInitialized);
	const delayRef = useRef(delay);
	delayRef.current = delay;
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	// Stable per-instance token so this editor's save error is isolated from
	// other useAutoSave instances (e.g. other panes) in the global store.
	const errorKeyRef = useRef<object>({});
	// Live view of hasUnsavedChanges for the flush-on-quit dirty check.
	const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
	hasUnsavedChangesRef.current = hasUnsavedChanges;

	useEffect(() => {
		onSaveRef.current = onSave;
	}, [onSave]);

	useEffect(() => {
		if (isInitialized && !prevIsInitializedRef.current) {
			const key = getAutoSaveKey(value, compareKey);
			initialValueRef.current = value;
			lastSavedValueRef.current = value;
			initialKeyRef.current = key;
			lastSavedKeyRef.current = key;
			hasUserMadeChangesRef.current = false;
			setHasUnsavedChanges(false);
		}
		prevIsInitializedRef.current = isInitialized;
	}, [isInitialized, value, compareKey]);

	const performSave = useCallback(async (retryCount = 0): Promise<void> => {
		if (isSavingRef.current) {
			return;
		}

		// Snapshot the content key being persisted. Edits that arrive while the
		// save is in flight advance currentKeyRef; marking the *newer* key as
		// saved would silently drop those edits (they'd never be flushed).
		const savedKey = currentKeyRef.current;
		const savedValue = lastValueRef.current;

		isSavingRef.current = true;
		setSaveState("saving");
		setSaveError(null);

		try {
			await onSaveRef.current();
			lastSavedValueRef.current = savedValue;
			lastSavedKeyRef.current = savedKey;
			setLastSaved(new Date());
			setSaveState("saved");
			retryCountRef.current = 0;
			useSaveErrorStore.getState().clearError(errorKeyRef.current);

			if (savedStateTimeoutRef.current) {
				clearTimeout(savedStateTimeoutRef.current);
			}
			savedStateTimeoutRef.current = window.setTimeout(() => {
				setSaveState("idle");
				savedStateTimeoutRef.current = null;
			}, timeoutsRef.current.savedStateDisplayMs);

			isSavingRef.current = false;

			// If edits landed during the save, currentKey is now ahead of the key
			// we persisted — flag dirty and schedule a follow-up save so they land.
			if (enabledRef.current && currentKeyRef.current !== savedKey) {
				setHasUnsavedChanges(true);
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}
				timeoutRef.current = window.setTimeout(() => {
					timeoutRef.current = null;
					if (!isSavingRef.current) {
						performSave();
					}
				}, delayRef.current);
			} else {
				setHasUnsavedChanges(false);
			}
			return;
		} catch (err) {
			const error = err instanceof Error ? err : new Error("Save failed");

			if (retryCount < timeoutsRef.current.autoSaveMaxRetries) {
				retryCountRef.current = retryCount + 1;
				const retryDelay = timeoutsRef.current.autoSaveRetryBaseMs * 2 ** retryCount;

				if (retryTimeoutRef.current) {
					clearTimeout(retryTimeoutRef.current);
				}
				retryTimeoutRef.current = window.setTimeout(() => {
					performSave(retryCount + 1);
					retryTimeoutRef.current = null;
				}, retryDelay);
			} else {
				setSaveError(error);
				setSaveState("error");
				retryCountRef.current = 0;
				useSaveErrorStore.getState().setError(errorKeyRef.current, error, saveNow);
			}
		} finally {
			isSavingRef.current = false;
		}
	}, []);

	const saveNow = useCallback(async () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		await performSave();
	}, [performSave]);

	useEffect(() => {
		const key = errorKeyRef.current;
		const unregister = registerSaver(saveNow, () => hasUnsavedChangesRef.current);
		return () => {
			unregister();
			// Drop this instance's error when it unmounts so a closed pane can't
			// leave a stale error/dirty flag blocking navigation.
			useSaveErrorStore.getState().clearError(key);
		};
	}, [saveNow]);

	useEffect(() => {
		lastValueRef.current = value;
		const currentKey = getAutoSaveKey(value, compareKey);
		currentKeyRef.current = currentKey;
		const valueChanged = currentKey !== lastSavedKeyRef.current;
		const changedFromInitial = currentKey !== initialKeyRef.current;

		if (changedFromInitial && !hasUserMadeChangesRef.current) {
			hasUserMadeChangesRef.current = true;
		}

		setHasUnsavedChanges(valueChanged);

		if (!enabled || !valueChanged || !hasUserMadeChangesRef.current) {
			return;
		}

		if (isSavingRef.current) {
			return;
		}

		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = window.setTimeout(() => {
			if (!isSavingRef.current) {
				performSave();
			}
			timeoutRef.current = null;
		}, delay);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [value, enabled, delay, performSave, compareKey]);

	useEffect(() => {
		if (!saveOnBlur || !enabled || !isInitialized) {
			return;
		}

		const handleBlur = () => {
			if (hasUnsavedChanges && !isSavingRef.current) {
				saveNow();
			}
		};

		window.addEventListener("blur", handleBlur);
		return () => window.removeEventListener("blur", handleBlur);
	}, [saveOnBlur, enabled, isInitialized, hasUnsavedChanges, saveNow]);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges) {
				saveNow();
				e.preventDefault();
				e.returnValue = "";
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [enabled, hasUnsavedChanges, saveNow]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			if (savedStateTimeoutRef.current) {
				clearTimeout(savedStateTimeoutRef.current);
				savedStateTimeoutRef.current = null;
			}
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const isDirtyWithError = saveState === "error" && hasUnsavedChanges;
		useSaveErrorStore.getState().setDirtyError(errorKeyRef.current, isDirtyWithError);
	}, [saveState, hasUnsavedChanges]);

	return {
		saveState,
		lastSaved,
		saveError,
		saveNow,
		hasUnsavedChanges,
	};
};

function getAutoSaveKey<T>(value: T, compareKey?: string): string {
	if (compareKey !== undefined) {
		return compareKey;
	}

	if (value == null) {
		return "";
	}

	const type = typeof value;

	if (type === "string" || type === "number" || type === "boolean") {
		return String(value);
	}

	return JSON.stringify(value);
}
