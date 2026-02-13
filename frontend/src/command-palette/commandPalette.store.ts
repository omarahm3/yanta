import { create } from "zustand";
import { useDialogStore } from "../shared/stores/dialog.store";

interface CommandPaletteState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	/** For tests: reset open state. */
	reset: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
	isOpen: false,
	open: () => {
		useDialogStore.getState().openDialog();
		set({ isOpen: true });
	},
	close: () => {
		set({ isOpen: false });
		useDialogStore.getState().closeDialog();
	},
	reset: () => {
		if (get().isOpen) useDialogStore.getState().closeDialog();
		set({ isOpen: false });
	},
}));
