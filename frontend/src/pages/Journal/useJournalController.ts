import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListDates } from "../../../bindings/yanta/internal/journal/wailsservice";
import { useProjectContext } from "../../contexts";
import { useHelp } from "../../hooks";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import type { HotkeyConfig } from "../../types/hotkeys";
import type { JournalEntryData } from "./JournalEntry";
import { useJournal } from "./useJournal";

function addDays(dateStr: string, delta: number): string {
	const d = new Date(dateStr);
	d.setDate(d.getDate() + delta);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

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

export interface ConfirmDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	danger?: boolean;
}

export interface JournalControllerOptions {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
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

	const [datesWithEntries, setDatesWithEntries] = useState<string[]>([]);
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
		isOpen: false,
		title: "",
		message: "",
		onConfirm: () => {},
	});

	const {
		entries,
		isLoading,
		error,
		isEmpty,
		selectedIds,
		date,
		setDate,
		deleteEntry,
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
	const highlightedIndexRef = useRef(highlightedIndex);
	const selectedIdsRef = useRef(selectedIds);

	useEffect(() => {
		entriesRef.current = entries;
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
				console.error("Failed to load dates:", err);
			}
		};
		loadDates();
	}, [projectAlias]);

	// Reset highlighted index when entries change
	useEffect(() => {
		setHighlightedIndex(0);
	}, [entries]);

	const sidebarSections = useSidebarSections({
		currentPage: "journal",
		onNavigate: (page) => onNavigate?.(page),
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

	// Entry click handler
	const handleEntryClick = useCallback(
		(id: string) => {
			const index = entries.findIndex((e) => e.id === id);
			if (index !== -1) {
				setHighlightedIndex(index);
			}
		},
		[entries],
	);

	// Delete selected entries with confirmation
	const handleDeleteSelected = useCallback(() => {
		const ids = Array.from(selectedIdsRef.current);
		if (ids.length === 0) return;

		const count = ids.length;
		const message =
			count === 1
				? "Are you sure you want to delete this journal entry?"
				: `Are you sure you want to delete ${count} journal entries?`;

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
				} catch (err) {
					console.error("Failed to delete entries:", err);
				} finally {
					setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
				}
			},
		});
	}, [deleteEntry, clearSelection]);

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
			console.error("Failed to promote to document:", err);
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
		setDate(addDays(date, -1));
	}, [date, setDate]);

	const goToNextDay = useCallback(() => {
		setDate(addDays(date, 1));
	}, [date, setDate]);

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				key: "ctrl+n",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ctrl+p",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
				description: "Previous day",
			},
			{
				key: "ArrowRight",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToNextDay();
				},
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ArrowLeft",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					goToPrevDay();
				},
				allowInInput: false,
				description: "Previous day",
			},
			{
				key: "j",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
				description: "Highlight next entry",
			},
			{
				key: "k",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
				description: "Highlight previous entry",
			},
			{
				key: "ArrowDown",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
				description: "Navigate down",
			},
			{
				key: "ArrowUp",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
				description: "Navigate up",
			},
			{
				key: "Space",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					toggleSelection();
				},
				allowInInput: false,
				description: "Select/deselect highlighted entry",
			},
			{
				key: "mod+D",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelected();
				},
				allowInInput: false,
				description: "Delete selected entries",
			},
			{
				key: "mod+shift+p",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handlePromoteSelected();
				},
				allowInInput: false,
				description: "Promote selected entries to document",
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
