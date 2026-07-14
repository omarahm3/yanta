import { create } from "zustand";
import { useDialogStore } from "../shared/stores/dialog.store";

interface GlobalSearchState {
	isOpen: boolean;
	lastQuery: string;
	open: () => void;
	close: () => void;
	toggle: () => void;
	setLastQuery: (query: string) => void;
	/** For tests: reset open state. */
	reset: () => void;
}

/**
 * Open/close state for the global document search finder (⌘F). Mirrors the
 * project switcher: opening bumps the shared dialog counter so app-wide hotkeys
 * are suppressed while the finder owns the keyboard, and closing releases it.
 */
export const useGlobalSearchStore = create<GlobalSearchState>((set, get) => ({
	isOpen: false,
	lastQuery: "",
	open: () => {
		// Idempotent: the ⌘F hotkey fires in inputs, so guard against a second
		// openDialog() (which would leave the dialog counter permanently raised).
		if (get().isOpen) return;
		useDialogStore.getState().openDialog();
		set({ isOpen: true });
	},
	close: () => {
		set({ isOpen: false });
		useDialogStore.getState().closeDialog();
	},
	toggle: () => {
		if (get().isOpen) get().close();
		else get().open();
	},
	setLastQuery: (query: string) => set({ lastQuery: query }),
	reset: () => {
		if (get().isOpen) useDialogStore.getState().closeDialog();
		set({ isOpen: false, lastQuery: "" });
	},
}));
