import { useCallback, useEffect, useState } from "react";

export interface UseLocalStorageOptions<T> {
	validate?: (data: unknown) => T | null;
	serialize?: (value: T) => string;
	deserialize?: (raw: string) => unknown;
	onError?: (operation: "load" | "save", error: unknown) => void;
}

export function useLocalStorage<T>(
	key: string,
	defaultValue: T,
	options: UseLocalStorageOptions<T> = {},
): [T, (value: T | ((prev: T) => T)) => void] {
	const {
		validate,
		serialize = JSON.stringify,
		deserialize = JSON.parse,
		onError,
	} = options;

	const loadData = useCallback((): T => {
		try {
			const stored = localStorage.getItem(key);
			if (!stored) {
				return defaultValue;
			}
			const parsed = deserialize(stored);
			if (validate) {
				const validated = validate(parsed);
				return validated !== null ? validated : defaultValue;
			}
			return parsed as T;
		} catch (err) {
			onError?.("load", err);
			return defaultValue;
		}
	}, [key, defaultValue, deserialize, validate, onError]);

	const [state, setState] = useState<T>(() => loadData());

	const saveData = useCallback(
		(value: T): void => {
			try {
				localStorage.setItem(key, serialize(value));
			} catch (err) {
				onError?.("save", err);
			}
		},
		[key, serialize, onError],
	);

	const setValue = useCallback(
		(value: T | ((prev: T) => T)) => {
			setState((prev) => {
				const nextValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
				saveData(nextValue);
				return nextValue;
			});
		},
		[saveData],
	);

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === key) {
				setState(loadData());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [key, loadData]);

	return [state, setValue];
}
