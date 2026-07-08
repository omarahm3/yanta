import { create } from "zustand";

interface SaveErrorState {
	error: Error | null;
	retryFn: (() => Promise<void>) | null;
	hasDirtyError: boolean;
	setError: (error: Error | null, retryFn?: (() => Promise<void>) | null) => void;
	clearError: () => void;
	setDirtyError: (dirty: boolean) => void;
}

export const useSaveErrorStore = create<SaveErrorState>((set) => ({
	error: null,
	retryFn: null,
	hasDirtyError: false,
	setError: (error, retryFn = null) => set({ error, retryFn, hasDirtyError: error !== null }),
	clearError: () => set({ error: null, retryFn: null, hasDirtyError: false }),
	setDirtyError: (dirty) => set({ hasDirtyError: dirty }),
}));
