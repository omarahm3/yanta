import { useEffect } from "react";
import { create } from "zustand";
import { getPreferencesOverrides, setPreferencesOverrides } from "../services/ConfigService";
import { BackendLogger } from "../utils/backendLogger";

const CACHE_KEY = "yanta_theme_cache";
const DEFAULT_THEME: ThemeMode = "system";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

interface ThemeState {
	theme: ThemeMode;
	resolved: ResolvedTheme;
	hydrated: boolean;
	setTheme: (value: ThemeMode) => Promise<void>;
	hydrate: () => Promise<void>;
}

function isThemeMode(v: unknown): v is ThemeMode {
	return v === "dark" || v === "light" || v === "system";
}

function readCache(): ThemeMode {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (raw && isThemeMode(raw)) return raw;
	} catch (err) {
		BackendLogger.error("[theme.store] cache read failed:", err);
	}
	return DEFAULT_THEME;
}

function writeCache(value: ThemeMode): void {
	try {
		localStorage.setItem(CACHE_KEY, value);
	} catch (err) {
		BackendLogger.error("[theme.store] cache write failed:", err);
	}
}

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "dark";
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
	return mode === "system" ? getSystemTheme() : mode;
}

// Monotonic counter to detect stale async results from interleaved
// setTheme/hydrate calls; a later op invalidates earlier in-flight ones.
let opSeq = 0;

const initialTheme = readCache();

export const useThemeStore = create<ThemeState>()((set, get) => ({
	theme: initialTheme,
	resolved: resolveTheme(initialTheme),
	hydrated: false,
	setTheme: async (value) => {
		const op = ++opSeq;
		const prev = get().theme;
		set({ theme: value, resolved: resolveTheme(value), hydrated: true });
		writeCache(value);
		try {
			const current = await getPreferencesOverrides();
			await setPreferencesOverrides({
				...current,
				appearance: { ...current.appearance, theme: value },
			});
		} catch (err) {
			if (op !== opSeq) {
				BackendLogger.error("[theme.store] stale setTheme rollback dropped:", err);
				return;
			}
			BackendLogger.error("[theme.store] persist failed, reverting:", err);
			set({ theme: prev, resolved: resolveTheme(prev) });
			writeCache(prev);
		}
	},
	hydrate: async () => {
		const op = ++opSeq;
		try {
			const prefs = await getPreferencesOverrides();
			if (op !== opSeq) return;
			const fromConfig = prefs.appearance?.theme ?? DEFAULT_THEME;
			set({ theme: fromConfig, resolved: resolveTheme(fromConfig), hydrated: true });
			writeCache(fromConfig);
		} catch (err) {
			if (op !== opSeq) return;
			BackendLogger.error("[theme.store] hydrate failed:", err);
			set({ hydrated: true });
		}
	},
}));

export function useTheme(): ThemeMode {
	return useThemeStore((s) => s.theme);
}

export function useResolvedTheme(): ResolvedTheme {
	return useThemeStore((s) => s.resolved);
}

export function ThemeInit() {
	const mode = useTheme();
	const resolved = useResolvedTheme();
	const hydrate = useThemeStore((s) => s.hydrate);
	const hydrated = useThemeStore((s) => s.hydrated);

	useEffect(() => {
		if (!hydrated) void hydrate();
	}, [hydrated, hydrate]);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", resolved);
	}, [resolved]);

	useEffect(() => {
		if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) return;
		const mql = window.matchMedia("(prefers-color-scheme: light)");
		const onChange = () => {
			useThemeStore.setState({ resolved: getSystemTheme() });
		};
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [mode]);

	return null;
}
