import { create } from "zustand";

export type TitleBarChrome = "hidden" | "frameless" | "macos";

interface TitleBarState {
	heightInRem: number;
	chrome: TitleBarChrome;
	setChrome: (chrome: TitleBarChrome, heightInRem: number) => void;
}

export const useTitleBarStore = create<TitleBarState>((set) => ({
	heightInRem: 0,
	chrome: "hidden",
	setChrome: (chrome, heightInRem) => set({ chrome, heightInRem }),
}));

export interface TitleBarContextType {
	heightInRem: number;
	chrome: TitleBarChrome;
	setChrome: (chrome: TitleBarChrome, heightInRem: number) => void;
}

export function useTitleBarContext(): TitleBarContextType {
	const heightInRem = useTitleBarStore((s) => s.heightInRem);
	const chrome = useTitleBarStore((s) => s.chrome);
	const setChrome = useTitleBarStore((s) => s.setChrome);
	return { heightInRem, chrome, setChrome };
}
