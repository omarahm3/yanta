import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommandOption, SubPaletteItem } from "../../components/ui";
import { TIMEOUTS } from "../../config";
import { useDocumentContext, useProjectContext } from "../../contexts";
import { useNotification } from "../../hooks/useNotification";
import { useRecentDocuments } from "../../hooks/useRecentDocuments";
import { usePaneLayout } from "../../pane";
import type { NavigationState, PageName } from "../../types";
import { formatRelativeTimeFromTimestamp } from "../../utils/dateUtils";
import { type ParsedGitError, parseGitError } from "../../utils/gitErrorParser";
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

const REGISTRY_SOURCES = [
	"navigation",
	"create",
	"document",
	"git",
	"projects",
	"application",
] as const;

export interface UseGlobalCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onNavigate: (page: PageName, state?: NavigationState) => void;
	currentPage?: PageName;
	onToggleArchived?: () => void;
	showArchived?: boolean;
	onToggleSidebar?: () => void;
	onShowHelp?: () => void;
}

export interface UseGlobalCommandPaletteReturn {
	handleClose: () => void;
	handleCommandSelect: (command: CommandOption) => void;
	sortedCommands: CommandOption[];
	recentDocumentItems: SubPaletteItem[];
	showRecentDocuments: boolean;
	handleSubPaletteBack: () => void;
	isErrorDialogOpen: boolean;
	closeErrorDialog: () => void;
	gitError: ParsedGitError | null;
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

	const showGitError = useCallback((error: unknown) => {
		const parsed = parseGitError(error);
		setGitError(parsed);
		setIsErrorDialogOpen(true);
	}, []);

	const closeErrorDialog = useCallback(() => {
		setIsErrorDialogOpen(false);
		setTimeout(() => setGitError(null), TIMEOUTS.gitErrorDismissMs);
	}, []);

	const handleClose = useCallback(() => {
		setShowRecentDocuments(false);
		onClose();
	}, [onClose]);

	const handleSubPaletteBack = useCallback(() => {
		setShowRecentDocuments(false);
	}, []);

	const handleCommandSelect = useCallback(
		(command: CommandOption) => {
			recordCommandUsage(command.id);
		},
		[recordCommandUsage],
	);

	const recentDocumentItems: SubPaletteItem[] = useMemo(() => {
		return recentDocuments.map((doc) => ({
			id: `recent-${doc.path}`,
			icon: <FileText className="w-4 h-4" />,
			text: doc.title || "Untitled",
			hint: formatRelativeTimeFromTimestamp(doc.lastOpened),
			action: () => {
				onNavigate("document", { path: doc.path, projectAlias: doc.projectAlias });
				handleClose();
			},
		}));
	}, [recentDocuments, onNavigate, handleClose]);

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
			onNavigate,
			handleClose,
			currentPage,
			currentProject: currentProject ?? null,
			previousProject: previousProject ?? null,
			projects,
			setCurrentProject,
			switchToLastProject,
			getSelectedDocument,
			notification,
			showGitError,
			onToggleArchived,
			showArchived,
			onToggleSidebar,
			onShowHelp,
			resetLayout,
			setShowRecentDocuments,
		}),
		[
			onNavigate,
			handleClose,
			currentPage,
			currentProject,
			previousProject,
			projects,
			setCurrentProject,
			switchToLastProject,
			getSelectedDocument,
			notification,
			showGitError,
			onToggleArchived,
			showArchived,
			onToggleSidebar,
			onShowHelp,
			resetLayout,
		],
	);

	// Register all domain commands whenever context changes; cleanup on unmount
	useEffect(() => {
		registerNavigationCommands(registry, ctx);
		registerCreateCommands(registry, ctx);
		registerDocumentCommands(registry, ctx);
		registerGitCommands(registry, ctx);
		registerProjectCommands(registry, ctx);
		registerApplicationCommands(registry, ctx);
		return () => {
			for (const source of REGISTRY_SOURCES) {
				registry.removeSource(source);
			}
		};
	}, [registry, ctx]);

	// Subscribe to sources so we only recompute when registry actually changes
	const sources = useCommandRegistryStore((state) => state.sources);
	const commandOptions = useMemo(
		() => useCommandRegistryStore.getState().getAllCommands(),
		[sources],
	);

	// Sort commands by usage (recency + frequency) and mark top 5 as isRecent
	const sortedCommands = useMemo(() => {
		const usage = getAllCommandUsage();
		const sorted = sortCommandsByUsage(commandOptions, usage);
		const recentIds = getTopRecentCommandIds(usage, 5);
		return sorted.map((cmd) => ({
			...cmd,
			isRecent: recentIds.has(cmd.id),
		}));
	}, [commandOptions, getAllCommandUsage]);

	return {
		handleClose,
		handleCommandSelect,
		sortedCommands,
		recentDocumentItems,
		showRecentDocuments,
		handleSubPaletteBack,
		isErrorDialogOpen,
		closeErrorDialog,
		gitError,
	};
}
