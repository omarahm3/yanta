import { useCallback, useEffect, useRef, useState } from "react";
import { ListDates } from "../../bindings/yanta/internal/journal/wailsservice";
import { formatShortcutKeyForDisplay } from "../config/shortcuts";
import { useMergedConfig } from "../config/usePreferencesOverrides";
import { useHelp } from "../help";
import { useProjectContext } from "../project";
import { useNotification, useSidebarSections } from "../shared/hooks";
import type { NavigationState, PageName } from "../shared/types";
import type { HotkeyConfig } from "../shared/types/hotkeys";
import { BackendLogger } from "../shared/utils/backendLogger";
import { addDaysLocalString } from "../shared/utils/date";
import type { JournalEntryData } from "./JournalEntry";
import { useJournal } from "./useJournal";
import { type ConfirmDialogState, useJournalDialogs } from "./useJournalDialogs";
import { useJournalHotkeysConfig } from "./useJournalHotkeysConfig";

export type { ConfirmDialogState } from "./useJournalDialogs";

const helpCommands = [
	{
		command: "j / ↓",
		description: "Navigate to next entry",
	},
	{
		command: "k / ↑",
		description: "Navigate to previous entry",
	},
	{
		command: "Space",
		description: "Select/deselect highlighted entry",
	},
	{
		command: "Escape",
		description: "Clear selection",
	},
	{
		command: "Ctrl+D",
		description: "Delete selected entries",
	},
	{
		command: "Ctrl+Shift+P",
		description: "Promote selected entries to document",
	},
	{
		command: "Ctrl+N / →",
		description: "Next day",
	},
	{
		command: "Ctrl+P / ←",
		description: "Previous day",
	},
];

export interface JournalControllerOptions {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	initialDate?: string;
}

export interface JournalControllerResult {
	// Data
	entries: JournalEntryData[];
	isLoading: boolean;
	error: string | null;
	isEmpty: boolean;
	projectAlias: string;
	date: string;
	datesWithEntries: string[];

	// Navigation
	highlightedIndex: number;
	setHighlightedIndex: (index: number) => void;
	highlightNext: () => void;
	highlightPrevious: () => void;

	// Selection
	selectedIds: Set<string>;
	toggleSelection: (id?: string) => void;
	clearSelection: () => void;

	// Actions
	setDate: (date: string) => void;
	handleEntryClick: (id: string) => void;
	handleDeleteSelected: () => void;
	handlePromoteSelected: () => Promise<void>;
	updateEntry: (id: string, content: string, tags: string[]) => Promise<void>;
	addEntry: (rawText: string) => Promise<void>;
	/** Formatted Quick Capture hotkey, shown on the in-page add affordance. */
	quickCaptureHint: string;

	// UI
	sidebarSections: ReturnType<typeof useSidebarSections>;
	hotkeys: HotkeyConfig[];
	confirmDialog: ConfirmDialogState;
	setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
	statusBar: {
		totalEntries: number;
		currentContext: string;
		selectedCount: number;
	};
}

export function useJournalController({
	onNavigate,
	initialDate,
}: JournalControllerOptions): JournalControllerResult {
	const { currentProject } = useProjectContext();
	const projectAlias = currentProject?.alias || "@personal";
	const { setPageContext } = useHelp();
	const { error: notifyError, success: notifySuccess } = useNotification();
	const { shortcuts } = useMergedConfig();
	const quickCaptureHint = formatShortcutKeyForDisplay(shortcuts.quickCapture.default.key);

	const [datesWithEntries, setDatesWithEntries] = useState<string[]>([]);
	const [highlightedIndex, setHighlightedIndex] = useState(0);

	const { confirmDialog, setConfirmDialog } = useJournalDialogs();

	const {
		entries,
		isLoading,
		error,
		isEmpty,
		selectedIds,
		date,
		setDate,
		deleteEntry,
		restoreEntry,
		updateEntry,
		addEntry,
		promoteToDocument,
		toggleSelection: toggleSelectionById,
		clearSelection,
	} = useJournal({ projectAlias, date: initialDate });

	// Set help context for Journal page
	useEffect(() => {
		setPageContext(helpCommands, "Journal");
	}, [setPageContext]);

	// Refs for hotkey handlers (to avoid stale closures)
	const entriesRef = useRef(entries);
	const entriesByIdRef = useRef(new Map<string, number>());
	const highlightedIndexRef = useRef(highlightedIndex);
	const selectedIdsRef = useRef(selectedIds);

	useEffect(() => {
		entriesRef.current = entries;
		const byId = new Map<string, number>();
		for (let i = 0; i < entries.length; i++) {
			byId.set(entries[i].id, i);
		}
		entriesByIdRef.current = byId;
		highlightedIndexRef.current = highlightedIndex;
		selectedIdsRef.current = selectedIds;
	}, [entries, highlightedIndex, selectedIds]);

	// Load dates with entries for calendar highlighting
	useEffect(() => {
		const loadDates = async () => {
			try {
				const dates = await ListDates(projectAlias, 0, 0);
				setDatesWithEntries(dates as string[]);
			} catch (err) {
				BackendLogger.error("Failed to load dates:", err);
				notifyError("Failed to load journal dates");
			}
		};
		loadDates();
	}, [projectAlias, notifyError]);

	// Reset highlighted index when entries change
	useEffect(() => {
		setHighlightedIndex(0);
	}, [entries]);

	const sidebarSections = useSidebarSections({
		currentPage: "journal",
		onNavigate: (page) => onNavigate?.(page),
		onOpenDocument: (path) => onNavigate?.("document", { documentPath: path }),
	});

	// Navigation
	const highlightNext = useCallback(() => {
		setHighlightedIndex((prev) => {
			const max = entriesRef.current.length - 1;
			return prev < max ? prev + 1 : prev;
		});
	}, []);

	const highlightPrevious = useCallback(() => {
		setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
	}, []);

	// Toggle selection (uses highlighted if no id provided)
	const toggleSelection = useCallback(
		(id?: string) => {
			let targetId = id;
			if (!targetId) {
				const entry = entriesRef.current[highlightedIndexRef.current];
				if (entry) {
					targetId = entry.id;
				}
			}
			if (targetId) {
				toggleSelectionById(targetId);
			}
		},
		[toggleSelectionById],
	);

	// Entry click handler (O(1) lookup via Map)
	const handleEntryClick = useCallback((id: string) => {
		const index = entriesByIdRef.current.get(id);
		if (index !== undefined) {
			setHighlightedIndex(index);
		}
	}, []);

	// Delete selected entries with confirmation
	const handleDeleteSelected = useCallback(() => {
		const ids = Array.from(selectedIdsRef.current);
		if (ids.length === 0) return;

		const count = ids.length;
		const message =
			count === 1
				? "Delete this journal entry? You can undo right after, or restore it later."
				: `Delete ${count} journal entries? You can undo right after, or restore them later.`;

		setConfirmDialog({
			isOpen: true,
			title: count === 1 ? "Delete Journal Entry" : "Delete Journal Entries",
			message,
			danger: true,
			onConfirm: async () => {
				try {
					for (const id of ids) {
						await deleteEntry(id);
					}
					clearSelection();
					notifySuccess(count === 1 ? "Entry deleted" : `${count} entries deleted`, {
						action: {
							label: "Undo",
							onClick: () => {
								void (async () => {
									for (const id of ids) {
										try {
											await restoreEntry(id);
										} catch (err) {
											BackendLogger.error("Failed to restore entry:", err);
										}
									}
								})();
							},
						},
					});
				} catch (err) {
					BackendLogger.error("Failed to delete entries:", err);
				} finally {
					setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
				}
			},
		});
	}, [deleteEntry, restoreEntry, clearSelection, notifySuccess]);

	// Promote selected entries to document
	const handlePromoteSelected = useCallback(async () => {
		const ids = Array.from(selectedIdsRef.current);
		if (ids.length === 0) return;

		try {
			const documentPath = await promoteToDocument({
				entryIds: ids,
				targetProject: projectAlias,
				title: "Journal Notes",
				keepOriginal: false,
			});

			clearSelection();

			if (onNavigate) {
				onNavigate("document", { documentPath });
			}
		} catch (err) {
			BackendLogger.error("Failed to promote to document:", err);
		}
	}, [promoteToDocument, projectAlias, clearSelection, onNavigate]);

	// Escape handler for clearing selection or closing dialog
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (confirmDialog.isOpen) {
					setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
				} else if (selectedIdsRef.current.size > 0) {
					clearSelection();
				}
			}
		};
		window.addEventListener("keydown", handleEsc);
		return () => window.removeEventListener("keydown", handleEsc);
	}, [clearSelection, confirmDialog.isOpen]);

	const goToPrevDay = useCallback(() => {
		setDate(addDaysLocalString(date, -1));
	}, [date, setDate]);

	const goToNextDay = useCallback(() => {
		setDate(addDaysLocalString(date, 1));
	}, [date, setDate]);

	const hotkeys: HotkeyConfig[] = useJournalHotkeysConfig({
		goToPrevDay,
		goToNextDay,
		highlightNext,
		highlightPrevious,
		toggleSelection,
		handleDeleteSelected,
		handlePromoteSelected,
	});

	return {
		// Data
		entries,
		isLoading,
		error,
		isEmpty,
		projectAlias,
		date,
		datesWithEntries,

		// Navigation
		highlightedIndex,
		setHighlightedIndex,
		highlightNext,
		highlightPrevious,

		// Selection
		selectedIds,
		toggleSelection,
		clearSelection,

		// Actions
		setDate,
		handleEntryClick,
		handleDeleteSelected,
		handlePromoteSelected,
		updateEntry,
		addEntry,
		quickCaptureHint,

		// UI
		sidebarSections,
		hotkeys,
		confirmDialog,
		setConfirmDialog,
		statusBar: {
			totalEntries: entries.length,
			currentContext: projectAlias,
			selectedCount: selectedIds.size,
		},
	};
}
