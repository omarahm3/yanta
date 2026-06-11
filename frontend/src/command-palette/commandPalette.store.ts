import { create } from "zustand";
import { useDialogStore } from "../shared/stores/dialog.store";

interface CommandPaletteState {
	isOpen: boolean;
	quickSwitcherMode: boolean;
	open: () => void;
	close: () => void;
	reset: () => void;
	setQuickSwitcherMode: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
	isOpen: false,
	quickSwitcherMode: false,
	open: () => {
		useDialogStore.getState().openDialog();
		set({ isOpen: true });
	},
	close: () => {
		set({ isOpen: false, quickSwitcherMode: false });
		useDialogStore.getState().closeDialog();
	},
	reset: () => {
		if (get().isOpen) useDialogStore.getState().closeDialog();
		set({ isOpen: false, quickSwitcherMode: false });
	},
	setQuickSwitcherMode: () => {
		set({ quickSwitcherMode: true });
	},
}));
