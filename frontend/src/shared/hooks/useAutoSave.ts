import { useCallback, useEffect, useRef, useState } from "react";
import { useMergedConfig } from "@/config";

export type SaveState = "idle" | "saving" | "saved" | "error";

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

		isSavingRef.current = true;
		setSaveState("saving");
		setSaveError(null);

		try {
			await onSaveRef.current();
			lastSavedValueRef.current = lastValueRef.current;
			lastSavedKeyRef.current = currentKeyRef.current;
			setLastSaved(new Date());
			setSaveState("saved");
			setHasUnsavedChanges(false);
			retryCountRef.current = 0;

			if (savedStateTimeoutRef.current) {
				clearTimeout(savedStateTimeoutRef.current);
			}
			savedStateTimeoutRef.current = window.setTimeout(() => {
				setSaveState("idle");
				savedStateTimeoutRef.current = null;
			}, timeoutsRef.current.savedStateDisplayMs);
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
