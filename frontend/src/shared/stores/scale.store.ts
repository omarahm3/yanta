import { create } from "zustand";

function applyScaleToDocument(scale: number) {
	document.documentElement.style.fontSize = `${scale * 100}%`;
}

interface ScaleState {
	scale: number;
	setScale: (scale: number) => void;
}

export const useScaleStore = create<ScaleState>((set) => ({
	scale: 1.0,
	setScale: (scale: number) => {
		set({ scale });
		applyScaleToDocument(scale);
	},
}));

/** Same API as legacy useScale from ScaleContext — use in components. */
export function useScale(): { scale: number; setScale: (scale: number) => void } {
	const scale = useScaleStore((s) => s.scale);
	const setScale = useScaleStore((s) => s.setScale);
	return { scale, setScale };
}
