import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../utils/backendLogger";

export type DensityMode = "comfortable" | "compact";

interface DensityState {
	mode: DensityMode;
	setMode: (mode: DensityMode) => void;
	toggleMode: () => void;
}

function applyDensity(mode: DensityMode) {
	document.documentElement.setAttribute("data-density", mode);
}

export const useDensityStore = create<DensityState>()(
	persist(
		(set, get) => ({
			mode: "comfortable",
			setMode: (mode) => {
				set({ mode });
				applyDensity(mode);
			},
			toggleMode: () => {
				const next = get().mode === "comfortable" ? "compact" : "comfortable";
				set({ mode: next });
				applyDensity(next);
			},
		}),
		{
			name: "yanta_density",
			onRehydrateStorage: () => (_state, error) => {
				if (error) {
					BackendLogger.error("[density.store] Failed to rehydrate:", error);
				}
			},
		},
	),
);

export function useDensity(): DensityMode {
	return useDensityStore((s) => s.mode);
}

export function DensityInit() {
	const mode = useDensity();
	useEffect(() => {
		applyDensity(mode);
	}, [mode]);
	return null;
}
