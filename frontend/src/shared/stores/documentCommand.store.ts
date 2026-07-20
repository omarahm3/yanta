import { create } from "zustand";

export type CanvasExportFormat = "png" | "svg";
/** Theme to render an exported canvas image in. Omitted = current canvas theme. */
export type CanvasExportTheme = "light" | "dark";

let saveHandler: (() => void) | null = null;
let findHandler: ((query?: string) => void) | null = null;
let replaceHandler: (() => void) | null = null;
let restoreHandler: (() => void) | null = null;
let exportImageHandler: ((format: CanvasExportFormat, theme?: CanvasExportTheme) => void) | null =
	null;

interface DocumentCommandState {
	registerSaveHandler: (handler: (() => void) | null) => void;
	requestSave: () => void;
	registerFindHandler: (handler: ((query?: string) => void) | null) => void;
	requestFind: (query?: string) => void;
	registerReplaceHandler: (handler: (() => void) | null) => void;
	requestReplace: () => void;
	registerRestoreHandler: (handler: (() => void) | null) => void;
	requestRestore: () => void;
	registerExportImageHandler: (
		handler: ((format: CanvasExportFormat, theme?: CanvasExportTheme) => void) | null,
	) => void;
	requestExportImage: (format: CanvasExportFormat, theme?: CanvasExportTheme) => void;
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
	requestFind: (query) => {
		if (findHandler) findHandler(query);
	},
	registerReplaceHandler: (handler) => {
		replaceHandler = handler;
	},
	requestReplace: () => {
		if (replaceHandler) replaceHandler();
	},
	registerRestoreHandler: (handler) => {
		restoreHandler = handler;
	},
	requestRestore: () => {
		if (restoreHandler) restoreHandler();
	},
	registerExportImageHandler: (handler) => {
		exportImageHandler = handler;
	},
	requestExportImage: (format, theme) => {
		if (exportImageHandler) exportImageHandler(format, theme);
	},
}));
