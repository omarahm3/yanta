import { useCallback, useEffect, useRef, useState } from "react";

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

	const validateRef = useRef(validate);
	const serializeRef = useRef(serialize);
	const deserializeRef = useRef(deserialize);
	const onErrorRef = useRef(onError);
	const defaultValueRef = useRef(defaultValue);

	validateRef.current = validate;
	serializeRef.current = serialize;
	deserializeRef.current = deserialize;
	onErrorRef.current = onError;
	defaultValueRef.current = defaultValue;

	const loadData = useCallback((): T => {
		try {
			const stored = localStorage.getItem(key);
			if (!stored) {
				return defaultValueRef.current;
			}
			const parsed = deserializeRef.current(stored);
			if (validateRef.current) {
				const validated = validateRef.current(parsed);
				return validated !== null ? validated : defaultValueRef.current;
			}
			return parsed as T;
		} catch (err) {
			onErrorRef.current?.("load", err);
			return defaultValueRef.current;
		}
	}, [key]);

	const [state, setState] = useState<T>(() => loadData());

	const setValue = useCallback(
		(value: T | ((prev: T) => T)) => {
			setState((prev) => {
				const nextValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
				try {
					localStorage.setItem(key, serializeRef.current(nextValue));
				} catch (err) {
					onErrorRef.current?.("save", err);
				}
				return nextValue;
			});
		},
		[key],
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
