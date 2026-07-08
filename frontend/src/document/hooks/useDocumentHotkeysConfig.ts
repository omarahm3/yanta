import { useMemo } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type { HotkeyConfig } from "../../shared/types/hotkeys";

export interface UseDocumentHotkeysConfigOptions {
	/** Ref whose .current is updated with the active pane state (read in handlers). */
	isActivePaneRef: { current: boolean };
	isArchived: boolean;
	error: (message: string) => void;
	saveNow: () => Promise<unknown>;
	handleExportToMarkdown: () => Promise<void>;
	handleExportToPDF: () => Promise<void>;
	handleEscape: (event: KeyboardEvent) => void;
	handleUnfocus: (event: KeyboardEvent) => void;
	focusEditor: () => void;
	openFind: () => void;
}

export function useDocumentHotkeysConfig({
	isActivePaneRef,
	isArchived,
	error,
	saveNow,
	handleExportToMarkdown,
	handleExportToPDF,
	handleEscape,
	handleUnfocus,
	focusEditor,
	openFind,
}: UseDocumentHotkeysConfigOptions): HotkeyConfig[] {
	const { shortcuts } = useMergedConfig();
	const document = shortcuts.document;

	return useMemo(
		() => [
			{
				...document.save,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before editing.");
						return;
					}
					void saveNow();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...document.documentSearch,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					openFind();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...document.exportMd,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before exporting.");
						return;
					}
					void handleExportToMarkdown();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...document.exportPdf,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before exporting.");
						return;
					}
					void handleExportToPDF();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...document.back,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					if (event.defaultPrevented) return false;
					handleEscape(event);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...document.unfocus,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					handleUnfocus(event);
				},
				allowInInput: true,
			},
			{
				...document.focusEditor,
				handler: () => {
					if (!isActivePaneRef.current) return false;
					focusEditor();
				},
				allowInInput: false,
			},
		],
		[
			document,
			saveNow,
			error,
			focusEditor,
			handleEscape,
			handleUnfocus,
			isArchived,
			handleExportToMarkdown,
			handleExportToPDF,
			isActivePaneRef,
			openFind,
		],
	);
}
