import { useMemo } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
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
	const { shortcuts } = useMergedConfig();
	const journal = shortcuts.journal;

	return useMemo(
		() => [
			{
				...journal.nextDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
			},
			{
				...journal.prevDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
			},
			{
				...journal.arrowNextDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
			},
			{
				...journal.arrowPrevDay,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
			},
			{
				...journal.highlightNext,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...journal.highlightPrev,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...journal.navigateDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...journal.navigateUp,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...journal.toggleSelection,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					toggleSelection();
				},
				allowInInput: false,
			},
			{
				...journal.delete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelected();
				},
				allowInInput: false,
			},
			{
				...journal.promote,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handlePromoteSelected();
				},
				allowInInput: false,
			},
		],
		[
			journal,
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
