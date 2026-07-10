import { useMemo } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import type { HotkeyConfig } from "../../shared/types/hotkeys";

export interface UseDashboardHotkeysConfigOptions {
	handleNewDocument: () => void;
	handleToggleArchived: () => void;
	handleDeleteSelectedDocuments: () => void;
	handleMoveSelectedDocuments: () => void;
	handleToggleSelection: () => void;
	handleSelectAll: () => void;
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
	handleSelectAll,
	handleOpenHighlightedDocument,
	highlightNext,
	highlightPrevious,
	handleArchiveSelectedDocuments,
	handleRestoreSelectedDocuments,
	handleExportSelectedMarkdown,
	handleExportSelectedPDF,
}: UseDashboardHotkeysConfigOptions): HotkeyConfig[] {
	const { shortcuts } = useMergedConfig();
	const dashboard = shortcuts.dashboard;

	return useMemo(() => {
		const all: HotkeyConfig[] = [
			{
				...dashboard.newDocument,
				handler: () => {
					void handleNewDocument();
				},
				allowInInput: false,
			},
			{
				...dashboard.toggleArchived,
				handler: handleToggleArchived as (event: KeyboardEvent) => void,
				allowInInput: false,
			},
			{
				...dashboard.selectAll,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleSelectAll();
				},
				allowInInput: false,
			},
			{
				...dashboard.permanentDelete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...dashboard.toggleSelection,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleToggleSelection();
				},
				allowInInput: false,
			},
			{
				...dashboard.openHighlighted,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleOpenHighlightedDocument();
				},
				allowInInput: false,
			},
			{
				...dashboard.highlightNext,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...dashboard.highlightPrev,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...dashboard.navigateDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...dashboard.navigateUp,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...dashboard.move,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleMoveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...dashboard.archive,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleArchiveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...dashboard.restore,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleRestoreSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...dashboard.exportMd,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedMarkdown();
				},
				allowInInput: false,
			},
			{
				...dashboard.exportPdf,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedPDF();
				},
				allowInInput: false,
			},
		];
		return all.filter((h) => h.key);
	}, [
		dashboard,
		handleNewDocument,
		handleToggleArchived,
		handleDeleteSelectedDocuments,
		handleMoveSelectedDocuments,
		handleToggleSelection,
		handleSelectAll,
		handleOpenHighlightedDocument,
		highlightNext,
		highlightPrevious,
		handleArchiveSelectedDocuments,
		handleRestoreSelectedDocuments,
		handleExportSelectedMarkdown,
		handleExportSelectedPDF,
	]);
}
