import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { useDocumentContext } from "../../document";
import { usePaneLayout } from "../../pane";
import { useProjectContext } from "../../project";
import { useNotification, useRecentDocuments } from "../../shared/hooks";
import type { NavigationState, PageName } from "../../shared/types";
import type { CommandOption, NoteResult, SubPaletteItem } from "../../shared/ui";
import { formatRelativeTimeFromTimestamp } from "../../shared/utils/date";
import { type ParsedGitError, parseGitError } from "../../shared/utils/gitErrorParser";
import { useCommandPaletteStore } from "../commandPalette.store";
import {
	type CommandRegistryContext,
	registerApplicationCommands,
	registerCreateCommands,
	registerDocumentCommands,
	registerGitCommands,
	registerNavigationCommands,
	registerProjectCommands,
	useCommandRegistryStore,
} from "../registry";
import { getTopRecentCommandIds, sortCommandsByUsage } from "../utils/commandSorting";
import { useCommandUsage } from "./useCommandUsage";
import { useNoteSearch } from "./useNoteSearch";

const REGISTRY_SOURCES = [
	"navigation",
	"create",
	"document",
	"git",
	"projects",
	"application",
] as const;

const RECENT_GROUP_LIMIT = 5;

export interface UseGlobalCommandPaletteProps {
	onClose: () => void;
	onNavigate: (page: PageName, state?: NavigationState) => void;
	currentPage?: PageName;
	onToggleArchived?: () => void;
	showArchived?: boolean;
	onToggleSidebar?: () => void;
	onShowHelp?: () => void;
}

export interface UseGlobalCommandPaletteReturn {
	isOpen: boolean;
	handleClose: () => void;
	handleCommandSelect: (command: CommandOption) => void;
	sortedCommands: CommandOption[];
	recentCommands: CommandOption[];
	recentDocumentItems: SubPaletteItem[];
	showRecentDocuments: boolean;
	handleSubPaletteBack: () => void;
	isErrorDialogOpen: boolean;
	closeErrorDialog: () => void;
	gitError: ParsedGitError | null;
	noteResults: NoteResult[];
	isSearchingNotes: boolean;
	handleSearchChange: (value: string) => void;
	handleNoteSelect: (result: NoteResult) => void;
}

export function useGlobalCommandPalette(
	props: UseGlobalCommandPaletteProps,
): UseGlobalCommandPaletteReturn {
	const {
		onClose,
		onNavigate,
		currentPage,
		onToggleArchived,
		showArchived,
		onToggleSidebar,
		onShowHelp,
	} = props;

	const isOpen = useCommandPaletteStore((s) => s.isOpen);
	const { projects, currentProject, setCurrentProject, previousProject, switchToLastProject } =
		useProjectContext();
	const { getSelectedDocument } = useDocumentContext();
	const { resetLayout } = usePaneLayout();
	const notification = useNotification();
	const { recentDocuments } = useRecentDocuments();
	const { recordCommandUsage, getAllCommandUsage } = useCommandUsage();
	const [gitError, setGitError] = useState<ParsedGitError | null>(null);
	const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
	const [showRecentDocuments, setShowRecentDocuments] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const clearGitErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { timeouts } = useMergedConfig();
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const onNavigateRef = useRef(onNavigate);
	onNavigateRef.current = onNavigate;
	const getSelectedDocumentRef = useRef(getSelectedDocument);
	getSelectedDocumentRef.current = getSelectedDocument;
	const notificationRef = useRef(notification);
	notificationRef.current = notification;
	const onToggleArchivedRef = useRef(onToggleArchived);
	onToggleArchivedRef.current = onToggleArchived;
	const onToggleSidebarRef = useRef(onToggleSidebar);
	onToggleSidebarRef.current = onToggleSidebar;
	const onShowHelpRef = useRef(onShowHelp);
	onShowHelpRef.current = onShowHelp;
	const resetLayoutRef = useRef(resetLayout);
	resetLayoutRef.current = resetLayout;
	const hasToggleArchived = Boolean(onToggleArchived);
	const hasToggleSidebar = Boolean(onToggleSidebar);
	const hasShowHelp = Boolean(onShowHelp);

	// Note quick-switcher: search by title as user types in the palette
	const { results: noteResults, isSearching: isSearchingNotes } = useNoteSearch(searchValue);

	// Reset search value when palette closes
	useEffect(() => {
		if (!isOpen) {
			setSearchValue("");
		}
	}, [isOpen]);

	const showGitError = useCallback((error: unknown) => {
		const parsed = parseGitError(error);
		setGitError(parsed);
		setIsErrorDialogOpen(true);
	}, []);

	const closeErrorDialog = useCallback(() => {
		setIsErrorDialogOpen(false);
		if (clearGitErrorTimeoutRef.current !== null) {
			clearTimeout(clearGitErrorTimeoutRef.current);
		}
		clearGitErrorTimeoutRef.current = setTimeout(() => {
			setGitError(null);
			clearGitErrorTimeoutRef.current = null;
		}, timeouts.gitErrorDismissMs);
	}, [timeouts.gitErrorDismissMs]);

	useEffect(
		() => () => {
			if (clearGitErrorTimeoutRef.current !== null) {
				clearTimeout(clearGitErrorTimeoutRef.current);
				clearGitErrorTimeoutRef.current = null;
			}
		},
		[],
	);

	const handleClose = useCallback(() => {
		setShowRecentDocuments(false);
		setSearchValue("");
		onCloseRef.current();
	}, []);

	const handleSubPaletteBack = useCallback(() => {
		setShowRecentDocuments(false);
	}, []);

	const handleSearchChange = useCallback((value: string) => {
		setSearchValue(value);
	}, []);

	const navigate = useCallback((page: PageName, state?: NavigationState) => {
		onNavigateRef.current(page, state);
	}, []);

	const getSelectedDocumentLatest = useCallback(() => {
		return getSelectedDocumentRef.current();
	}, []);

	const onToggleArchivedLatest = useCallback(() => {
		onToggleArchivedRef.current?.();
	}, []);

	const onToggleSidebarLatest = useCallback(() => {
		onToggleSidebarRef.current?.();
	}, []);

	const onShowHelpLatest = useCallback(() => {
		onShowHelpRef.current?.();
	}, []);

	const resetLayoutLatest = useCallback(() => {
		resetLayoutRef.current();
	}, []);

	const handleCommandSelect = useCallback(
		(command: CommandOption) => {
			recordCommandUsage(command.id);
		},
		[recordCommandUsage],
	);

	const handleNoteSelect = useCallback(
		(result: NoteResult) => {
			const targetProject = projects.find((p) => p.alias === result.projectAlias);
			if (targetProject) {
				setCurrentProject(targetProject);
			}
			if (result.type === "note") {
				navigate("journal", { date: result.path.split("/").pop(), noteId: result.noteId });
			} else {
				navigate("document", { path: result.path, projectAlias: result.projectAlias });
			}
		},
		[navigate, projects, setCurrentProject],
	);

	const recentDocumentItems: SubPaletteItem[] = useMemo(() => {
		return recentDocuments.map((doc) => ({
			id: `recent-${doc.path}`,
			icon: <FileText className="w-4 h-4" />,
			text: doc.title || "Untitled",
			hint: formatRelativeTimeFromTimestamp(doc.lastOpened),
			action: () => {
				navigate("document", { path: doc.path, projectAlias: doc.projectAlias });
				handleClose();
			},
		}));
	}, [recentDocuments, navigate, handleClose]);

	// Registry: stable reference so domain registration runs only when context changes
	const registry = useMemo(() => {
		const state = useCommandRegistryStore.getState();
		return {
			setCommands: state.setCommands,
			removeSource: state.removeSource,
			getAllCommands: state.getAllCommands,
		};
	}, []);

	// Build context for domain command registration
	const ctx: CommandRegistryContext = useMemo(
		() => ({
			onNavigate: navigate,
			handleClose,
			currentPage,
			currentProject: currentProject ?? null,
			previousProject: previousProject ?? null,
			projects,
			setCurrentProject,
			switchToLastProject,
			getSelectedDocument: getSelectedDocumentLatest,
			notification: {
				success: (msg: string) => notificationRef.current.success(msg),
				error: (msg: string) => notificationRef.current.error(msg),
				info: (msg: string) => notificationRef.current.info(msg),
				warning: (msg: string) => notificationRef.current.warning(msg),
			},
			showGitError,
			onToggleArchived: hasToggleArchived ? onToggleArchivedLatest : undefined,
			showArchived,
			onToggleSidebar: hasToggleSidebar ? onToggleSidebarLatest : undefined,
			onShowHelp: hasShowHelp ? onShowHelpLatest : undefined,
			resetLayout: resetLayoutLatest,
			setShowRecentDocuments,
		}),
		[
			navigate,
			handleClose,
			currentPage,
			currentProject,
			previousProject,
			projects,
			setCurrentProject,
			switchToLastProject,
			getSelectedDocumentLatest,
			showGitError,
			hasToggleArchived,
			onToggleArchivedLatest,
			showArchived,
			hasToggleSidebar,
			onToggleSidebarLatest,
			hasShowHelp,
			onShowHelpLatest,
			resetLayoutLatest,
			setShowRecentDocuments,
		],
	);

	// Register all domain commands whenever relevant command composition state changes
	useEffect(() => {
		registerNavigationCommands(registry, ctx);
		registerCreateCommands(registry, ctx);
		registerDocumentCommands(registry, ctx);
		registerGitCommands(registry, ctx);
		registerProjectCommands(registry, ctx);
		registerApplicationCommands(registry, ctx);
	}, [registry, ctx]);

	// Cleanup only on unmount
	useEffect(() => {
		return () => {
			for (const source of REGISTRY_SOURCES) {
				registry.removeSource(source);
			}
		};
	}, [registry]);

	// Subscribe to sources so we only recompute when registry actually changes
	const sources = useCommandRegistryStore((state) => state.sources);
	const commandOptions = useMemo(
		() => useCommandRegistryStore.getState().getAllCommands(),
		[sources],
	);

	// Sort commands by usage (recency + frequency) and mark top N as isRecent
	const sortedCommands = useMemo(() => {
		const usage = getAllCommandUsage();
		const sorted = sortCommandsByUsage(commandOptions, usage);
		const recentIds = getTopRecentCommandIds(usage, RECENT_GROUP_LIMIT);
		return sorted.map((cmd) => ({
			...cmd,
			isRecent: recentIds.has(cmd.id),
		}));
	}, [commandOptions, getAllCommandUsage]);

	// Extract recently-used commands for the dedicated "Recent" group at the top
	const recentCommands = useMemo(() => {
		return sortedCommands.filter((cmd) => cmd.isRecent).slice(0, RECENT_GROUP_LIMIT);
	}, [sortedCommands]);

	return {
		isOpen,
		handleClose,
		handleCommandSelect,
		sortedCommands,
		recentCommands,
		recentDocumentItems,
		showRecentDocuments,
		handleSubPaletteBack,
		isErrorDialogOpen,
		closeErrorDialog,
		gitError,
		noteResults,
		isSearchingNotes,
		handleSearchChange,
		handleNoteSelect,
	};
}
