import { create } from "zustand";

let saveHandler: (() => void) | null = null;
let findHandler: (() => void) | null = null;
let replaceHandler: (() => void) | null = null;

interface DocumentCommandState {
	registerSaveHandler: (handler: (() => void) | null) => void;
	requestSave: () => void;
	registerFindHandler: (handler: (() => void) | null) => void;
	requestFind: () => void;
	registerReplaceHandler: (handler: (() => void) | null) => void;
	requestReplace: () => void;
}

export const useDocumentCommandStore = create<DocumentCommandState>(() => ({
	registerSaveHandler: (handler) => {
		saveHandler = handler;
	},
	requestSave: () => {
		if (saveHandler) saveHandler();
	},
	registerFindHandler: (handler) => {
		findHandler = handler;
	},
	requestFind: () => {
		if (findHandler) findHandler();
	},
	registerReplaceHandler: (handler) => {
		replaceHandler = handler;
	},
	requestReplace: () => {
		if (replaceHandler) replaceHandler();
	},
}));
