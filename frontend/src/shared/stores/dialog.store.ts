import { create } from "zustand";

interface DialogState {
	openCount: number;
	openDialog: () => void;
	closeDialog: () => void;
	/** For tests: reset open count to 0. */
	reset: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
	openCount: 0,
	openDialog: () => set((s) => ({ openCount: s.openCount + 1 })),
	closeDialog: () => set((s) => ({ openCount: Math.max(0, s.openCount - 1) })),
	reset: () => set({ openCount: 0 }),
}));

export interface UseDialogReturn {
	isDialogOpen: boolean;
	openDialog: () => void;
	closeDialog: () => void;
}

/** Same API as legacy useDialog from DialogContext — use in components. */
export function useDialog(): UseDialogReturn {
	const openCount = useDialogStore((s) => s.openCount);
	const openDialog = useDialogStore((s) => s.openDialog);
	const closeDialog = useDialogStore((s) => s.closeDialog);
	return {
		isDialogOpen: openCount > 0,
		openDialog,
		closeDialog,
	};
}
