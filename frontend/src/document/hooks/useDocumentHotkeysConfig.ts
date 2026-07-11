import { useMemo } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type { EditorHandle } from "../../editor/types";
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
	openReplace: () => void;
	deleteBlock: () => void;
	moveBlockUp: () => void;
	moveBlockDown: () => void;
	duplicateBlock: () => void;
	toggleOutline: () => void;
	editorRef: React.RefObject<EditorHandle | null>;
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
	openReplace,
	deleteBlock,
	moveBlockUp,
	moveBlockDown,
	duplicateBlock,
	toggleOutline,
	editorRef,
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
				...document.documentReplace,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					openReplace();
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
		{
			...document.deleteBlock,
			handler: (event: KeyboardEvent) => {
				if (!isActivePaneRef.current) return false;
				event.preventDefault();
				event.stopPropagation();
				if (isArchived) {
					error("Restore the document before editing.");
					return;
				}
				deleteBlock();
			},
			allowInInput: true,
			capture: true,
		},
		{
			...document.moveBlockUp,
			handler: (event: KeyboardEvent) => {
				if (!isActivePaneRef.current) return false;
				event.preventDefault();
				event.stopPropagation();
				if (isArchived) {
					error("Restore the document before editing.");
					return;
				}
				moveBlockUp();
			},
			allowInInput: true,
			capture: true,
		},
		{
			...document.moveBlockDown,
			handler: (event: KeyboardEvent) => {
				if (!isActivePaneRef.current) return false;
				event.preventDefault();
				event.stopPropagation();
				if (isArchived) {
					error("Restore the document before editing.");
					return;
				}
				moveBlockDown();
			},
			allowInInput: true,
			capture: true,
		},
		{
			...document.duplicateBlock,
			handler: (event: KeyboardEvent) => {
				if (!isActivePaneRef.current) return false;
				event.preventDefault();
				event.stopPropagation();
				if (isArchived) {
					error("Restore the document before editing.");
					return;
				}
				duplicateBlock();
			},
			allowInInput: true,
			capture: true,
		},
		{
			...document.toggleOutline,
			handler: (event: KeyboardEvent) => {
				if (!isActivePaneRef.current) return false;
				event.preventDefault();
				event.stopPropagation();
				toggleOutline();
			},
			allowInInput: true,
			capture: true,
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
		openReplace,
		deleteBlock,
		moveBlockUp,
		moveBlockDown,
		duplicateBlock,
		toggleOutline,
		editorRef,
	],
);
}
