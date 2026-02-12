import { useMemo } from "react";
import { DASHBOARD_SHORTCUTS } from "../../config";
import type { HotkeyConfig } from "../../shared/types/hotkeys";

export interface UseDashboardHotkeysConfigOptions {
	handleNewDocument: () => void;
	handleToggleArchived: () => void;
	handleDeleteSelectedDocuments: (hard: boolean) => void;
	handleMoveSelectedDocuments: () => void;
	handleToggleSelection: () => void;
	handleOpenHighlightedDocument: () => void;
	highlightNext: () => void;
	highlightPrevious: () => void;
	handleArchiveSelectedDocuments: () => Promise<void>;
	handleRestoreSelectedDocuments: () => Promise<void>;
	handleExportSelectedMarkdown: () => Promise<void>;
	handleExportSelectedPDF: () => Promise<void>;
}

export function useDashboardHotkeysConfig({
	handleNewDocument,
	handleToggleArchived,
	handleDeleteSelectedDocuments,
	handleMoveSelectedDocuments,
	handleToggleSelection,
	handleOpenHighlightedDocument,
	highlightNext,
	highlightPrevious,
	handleArchiveSelectedDocuments,
	handleRestoreSelectedDocuments,
	handleExportSelectedMarkdown,
	handleExportSelectedPDF,
}: UseDashboardHotkeysConfigOptions): HotkeyConfig[] {
	return useMemo(
		() => [
			{
				...DASHBOARD_SHORTCUTS.newDocument,
				handler: () => {
					void handleNewDocument();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.toggleArchived,
				handler: handleToggleArchived as (event: KeyboardEvent) => void,
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.softDelete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelectedDocuments(false);
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.permanentDelete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelectedDocuments(true);
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.toggleSelection,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleToggleSelection();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.openHighlighted,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleOpenHighlightedDocument();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.highlightNext,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.highlightPrev,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.navigateDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.navigateUp,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.move,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleMoveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.archive,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleArchiveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.restore,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleRestoreSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.exportMd,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedMarkdown();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.exportPdf,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedPDF();
				},
				allowInInput: false,
			},
		],
		[
			handleNewDocument,
			handleToggleArchived,
			handleDeleteSelectedDocuments,
			handleMoveSelectedDocuments,
			handleToggleSelection,
			handleOpenHighlightedDocument,
			highlightNext,
			highlightPrevious,
			handleArchiveSelectedDocuments,
			handleRestoreSelectedDocuments,
			handleExportSelectedMarkdown,
			handleExportSelectedPDF,
		],
	);
}
