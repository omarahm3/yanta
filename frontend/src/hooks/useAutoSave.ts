import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface AutoSaveConfig<T> {
	value: T;
	onSave: () => Promise<void>;
	delay?: number;
	enabled?: boolean;
	saveOnBlur?: boolean;
	isInitialized?: boolean;
}

interface AutoSaveReturn {
	saveState: SaveState;
	lastSaved: Date | null;
	saveError: Error | null;
	saveNow: () => Promise<void>;
	hasUnsavedChanges: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

export const useAutoSave = <T>({
	value,
	onSave,
	delay = 2000,
	enabled = true,
	saveOnBlur = true,
	isInitialized = true,
}: AutoSaveConfig<T>): AutoSaveReturn => {
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
			console.log("[useAutoSave] isInitialized became true, resetting baselines to current value");
			initialValueRef.current = value;
			lastSavedValueRef.current = value;
			hasUserMadeChangesRef.current = false;
			setHasUnsavedChanges(false);
		}
		prevIsInitializedRef.current = isInitialized;
	}, [isInitialized, value]);

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
			}, 3000);
		} catch (err) {
			const error = err instanceof Error ? err : new Error("Save failed");

			if (retryCount < MAX_RETRIES) {
				retryCountRef.current = retryCount + 1;
				const retryDelay = RETRY_DELAY_BASE * 2 ** retryCount;

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

		const valueChanged = JSON.stringify(value) !== JSON.stringify(lastSavedValueRef.current);
		const changedFromInitial = JSON.stringify(value) !== JSON.stringify(initialValueRef.current);

		console.log("[useAutoSave] value effect", {
			valueChanged,
			changedFromInitial,
			hasUserMadeChanges: hasUserMadeChangesRef.current,
			enabled,
			isInitialized
		});

		if (changedFromInitial && !hasUserMadeChangesRef.current) {
			hasUserMadeChangesRef.current = true;
			console.log("[useAutoSave] First change from initial detected");
		}

		setHasUnsavedChanges(valueChanged);

		if (!enabled || !valueChanged || !hasUserMadeChangesRef.current) {
			return;
		}

		console.log("[useAutoSave] Starting debounce timer for save", { enabled, valueChanged, hasUserMadeChanges: hasUserMadeChangesRef.current });

		if (isSavingRef.current) {
			return;
		}

		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = window.setTimeout(() => {
			if (!isSavingRef.current) {
				console.log("[useAutoSave] Debounce timer fired, calling performSave");
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
	}, [value, enabled, delay, performSave]);

	useEffect(() => {
		if (!saveOnBlur || !enabled || !isInitialized) {
			return;
		}

		const handleBlur = () => {
			if (hasUnsavedChanges && !isSavingRef.current) {
				console.log("[useAutoSave] Window blur triggered save", { hasUnsavedChanges, isInitialized });
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
