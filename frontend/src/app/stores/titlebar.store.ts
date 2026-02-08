import { create } from "zustand";

interface TitleBarState {
	heightInRem: number;
	setHeight: (height: number) => void;
}

export const useTitleBarStore = create<TitleBarState>((set) => ({
	heightInRem: 2,
	setHeight: (height: number) => set({ heightInRem: height }),
}));

export interface TitleBarContextType {
	heightInRem: number;
	setHeight: (height: number) => void;
}

/** Same API as legacy useTitleBarContext — use in components. */
export function useTitleBarContext(): TitleBarContextType {
	const heightInRem = useTitleBarStore((s) => s.heightInRem);
	const setHeight = useTitleBarStore((s) => s.setHeight);
	return { heightInRem, setHeight };
}
