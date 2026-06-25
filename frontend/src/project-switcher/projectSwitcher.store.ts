import { create } from "zustand";
import { useDialogStore } from "../shared/stores/dialog.store";

interface ProjectSwitcherState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
	/** For tests: reset open state. */
	reset: () => void;
}

export const useProjectSwitcherStore = create<ProjectSwitcherState>((set, get) => ({
	isOpen: false,
	open: () => {
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
	reset: () => {
		if (get().isOpen) useDialogStore.getState().closeDialog();
		set({ isOpen: false });
	},
}));
