import { useEffect } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../utils/backendLogger";

const STORAGE_KEY = "yanta_appearance";

interface AppearanceState {
	reducedEffects: boolean;
	setReducedEffects: (value: boolean) => void;
}

function validateAppearance(data: unknown): { reducedEffects: boolean } | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	const parsed = data as Record<string, unknown>;
	if (typeof parsed.reducedEffects !== "boolean") {
		return null;
	}
	return { reducedEffects: parsed.reducedEffects };
}

const appearanceStorage: PersistStorage<{ reducedEffects: boolean }> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const validated = validateAppearance(parsed);
			return validated !== null ? { state: validated } : null;
		} catch (err) {
			BackendLogger.error("[appearance.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { reducedEffects: boolean } }) => {
		try {
			localStorage.setItem(name, JSON.stringify(value.state));
		} catch (err) {
			BackendLogger.error("[appearance.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[appearance.store] Failed to clear:", err);
		}
	},
};

export const useAppearanceStore = create<AppearanceState>()(
	persist(
		(set) => ({
			reducedEffects: false,
			setReducedEffects: (value) => set({ reducedEffects: value }),
		}),
		{
			name: STORAGE_KEY,
			storage: appearanceStorage,
			partialize: (s) => ({ reducedEffects: s.reducedEffects }),
		},
	),
);

export function useReducedEffects(): boolean {
	return useAppearanceStore((s) => s.reducedEffects);
}

/**
 * Sets data-reduced-effects on document.documentElement when the store value changes.
 * Must be rendered inside the app so the store is initialized.
 */
export function ReducedEffectsInit() {
	const reducedEffects = useReducedEffects();

	useEffect(() => {
		if (reducedEffects) {
			document.documentElement.setAttribute("data-reduced-effects", "true");
		} else {
			document.documentElement.removeAttribute("data-reduced-effects");
		}
	}, [reducedEffects]);

	return null;
}
