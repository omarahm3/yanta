import { Events } from "@wailsio/runtime";
import { useEffect, useSyncExternalStore } from "react";
import { usePreferencesStore } from "./preferences.store";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const DEFAULT_THEME: ThemeMode = "dark";

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "dark";
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
	return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme(): ThemeMode {
	return usePreferencesStore((s) => s.overrides?.appearance?.theme ?? DEFAULT_THEME);
}

const resolvedListeners = new Set<() => void>();
let resolvedSnapshot: ResolvedTheme | null = null;

function getSnapshot(): ResolvedTheme {
	if (resolvedSnapshot === null) resolvedSnapshot = getSystemTheme();
	return resolvedSnapshot;
}

function setResolved(v: ResolvedTheme): void {
	if (v === resolvedSnapshot) return;
	resolvedSnapshot = v;
	for (const l of resolvedListeners) l();
}

function subscribe(l: () => void): () => void {
	resolvedListeners.add(l);
	return () => {
		resolvedListeners.delete(l);
	};
}

export function useResolvedTheme(): ResolvedTheme {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function ThemeInit() {
	const mode = useTheme();
	useEffect(() => {
		const apply = (m: ThemeMode) => {
			const r = resolveTheme(m);
			setResolved(r);
			document.documentElement.setAttribute("data-theme", r);
		};
		apply(mode);

		// Listen to Go-emitted theme events for live updates
		const unsubscribe = Events.On("yanta/app/theme", (ev) => {
			const t = ev?.data?.theme;
			if (t === "dark" || t === "light" || t === "system") {
				apply(t as ThemeMode);
			}
		});

		// matchMedia for system theme changes
		if (mode !== "system" || typeof window === "undefined" || !window.matchMedia) {
			return () => {
				if (unsubscribe) unsubscribe();
			};
		}
		const mql = window.matchMedia("(prefers-color-scheme: light)");
		const onMqlChange = () => apply(mode);
		mql.addEventListener("change", onMqlChange);
		return () => {
			if (unsubscribe) unsubscribe();
			mql.removeEventListener("change", onMqlChange);
		};
	}, [mode]);
	return null;
}
