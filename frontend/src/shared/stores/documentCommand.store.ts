import { create } from "zustand";

/** Current save handler registered by the active document controller. Not in store state to avoid re-renders. */
let saveHandler: (() => void) | null = null;

/**
 * Cross-component document commands (replaces window.dispatchEvent("yanta:document:save")).
 * The active document controller registers a save callback; the command palette (or any caller) invokes requestSave().
 */
interface DocumentCommandState {
	registerSaveHandler: (handler: (() => void) | null) => void;
	requestSave: () => void;
}

export const useDocumentCommandStore = create<DocumentCommandState>(() => ({
	registerSaveHandler: (handler) => {
		saveHandler = handler;
	},
	requestSave: () => {
		if (saveHandler) saveHandler();
	},
}));
