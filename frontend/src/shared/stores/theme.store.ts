import { useEffect, useState } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../utils/backendLogger";

const STORAGE_KEY = "yanta_theme";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

interface ThemeState {
	theme: ThemeMode;
	setTheme: (value: ThemeMode) => void;
}

function isThemeMode(v: unknown): v is ThemeMode {
	return v === "dark" || v === "light" || v === "system";
}

function validateTheme(data: unknown): { theme: ThemeMode } | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
	const parsed = data as Record<string, unknown>;
	if (!isThemeMode(parsed.theme)) return null;
	return { theme: parsed.theme };
}

const themeStorage: PersistStorage<{ theme: ThemeMode }> = {
	getItem: (name) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const validated = validateTheme(parsed);
			return validated !== null ? { state: validated } : null;
		} catch (err) {
			BackendLogger.error("[theme.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name, value) => {
		try {
			localStorage.setItem(name, JSON.stringify(value.state));
		} catch (err) {
			BackendLogger.error("[theme.store] Failed to save:", err);
		}
	},
	removeItem: (name) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[theme.store] Failed to clear:", err);
		}
	},
};

export const useThemeStore = create<ThemeState>()(
	persist(
		(set) => ({
			theme: "dark",
			setTheme: (value) => set({ theme: value }),
		}),
		{
			name: STORAGE_KEY,
			storage: themeStorage,
			partialize: (s) => ({ theme: s.theme }),
		},
	),
);

export function useTheme(): ThemeMode {
	return useThemeStore((s) => s.theme);
}

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "dark";
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
	return mode === "system" ? getSystemTheme() : mode;
}

export function useResolvedTheme(): ResolvedTheme {
	const mode = useTheme();
	const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

	useEffect(() => {
		setResolved(resolveTheme(mode));
		if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(prefers-color-scheme: light)");
		const onChange = () => setResolved(getSystemTheme());
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [mode]);

	return resolved;
}

/**
 * Sets data-theme on document.documentElement based on theme store.
 * Resolves "system" via prefers-color-scheme and reacts to OS changes.
 */
export function ThemeInit() {
	const mode = useTheme();

	useEffect(() => {
		const apply = () => {
			const resolved = resolveTheme(mode);
			document.documentElement.setAttribute("data-theme", resolved);
		};
		apply();

		if (mode !== "system") return;
		const mql = window.matchMedia("(prefers-color-scheme: light)");
		const onChange = () => apply();
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [mode]);

	return null;
}
