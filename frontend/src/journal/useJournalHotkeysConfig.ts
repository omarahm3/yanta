import { useMemo } from "react";
import { JOURNAL_SHORTCUTS } from "@/config/public";
import type { HotkeyConfig } from "../shared/types/hotkeys";

export interface UseJournalHotkeysConfigOptions {
	goToPrevDay: () => void;
	goToNextDay: () => void;
	highlightNext: () => void;
	highlightPrevious: () => void;
	toggleSelection: () => void;
	handleDeleteSelected: () => void;
	handlePromoteSelected: () => Promise<void>;
}

export function useJournalHotkeysConfig({
	goToPrevDay,
	goToNextDay,
	highlightNext,
	highlightPrevious,
	toggleSelection,
	handleDeleteSelected,
	handlePromoteSelected,
}: UseJournalHotkeysConfigOptions): HotkeyConfig[] {
	return useMemo(
		() => [
			{
				...JOURNAL_SHORTCUTS.nextDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.prevDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.arrowNextDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.arrowPrevDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.highlightNext,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.highlightPrev,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.navigateDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.navigateUp,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.toggleSelection,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					toggleSelection();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.delete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelected();
				},
				allowInInput: false,
			},
			{
				...JOURNAL_SHORTCUTS.promote,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handlePromoteSelected();
				},
				allowInInput: false,
			},
		],
		[
			goToPrevDay,
			goToNextDay,
			highlightNext,
			highlightPrevious,
			toggleSelection,
			handleDeleteSelected,
			handlePromoteSelected,
		],
	);
}

