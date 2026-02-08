import {
	Archive,
	ArchiveRestore,
	ArrowLeftRight,
	ArrowRight,
	BookOpen,
	Bug,
	Calendar,
	Clock,
	CloudDownload,
	CloudUpload,
	FileDown,
	FilePlus,
	FileText,
	Folder,
	GitCommit,
	HelpCircle,
	LayoutDashboard,
	PanelLeft,
	RotateCcw,
	Save,
	Search,
	Settings,
} from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import {
	ExportDocumentRequest,
	ExportProjectRequest,
} from "../../../bindings/yanta/internal/document/models";
import { ExportDocument, ExportProject } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { SyncStatus } from "../../../bindings/yanta/internal/git/models";
import {
	GitPull,
	GitPush,
	OpenDirectoryDialog,
	SyncNow,
} from "../../../bindings/yanta/internal/system/service";
import {
	type CommandOption,
	CommandPalette,
	GitErrorDialog,
	type SubPaletteItem,
} from "../../components/ui";
import { TIMEOUTS } from "../../config";
import { useDocumentContext, useProjectContext } from "../../contexts";
import { useNotification } from "../../hooks/useNotification";
import { useRecentDocuments } from "../../hooks/useRecentDocuments";
import { usePaneLayout } from "../../pane";
import { DocumentServiceWrapper } from "../../services/DocumentService";
import { useDocumentCommandStore } from "../../shared/stores/documentCommand.store";
import type { NavigationState } from "../../types";
import { formatRelativeTimeFromTimestamp } from "../../utils/dateUtils";
import { type ParsedGitError, parseGitError } from "../../utils/gitErrorParser";
import { getShortcutForCommand } from "../../utils/shortcuts";
import { useCommandUsage } from "../hooks/useCommandUsage";
import { getTopRecentCommandIds, sortCommandsByUsage } from "../utils/commandSorting";

interface GlobalCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onNavigate: (page: string, state?: NavigationState) => void;
	currentPage?: string;
	onToggleArchived?: () => void;
	showArchived?: boolean;
	onToggleSidebar?: () => void;
	onShowHelp?: () => void;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
	isOpen,
	onClose,
	onNavigate,
	currentPage,
	onToggleArchived,
	showArchived,
	onToggleSidebar,
	onShowHelp,
}) => {
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

	const showGitError = (error: unknown) => {
		const parsed = parseGitError(error);
		setGitError(parsed);
		setIsErrorDialogOpen(true);
	};

	const closeErrorDialog = () => {
		setIsErrorDialogOpen(false);
		setTimeout(() => setGitError(null), TIMEOUTS.gitErrorDismissMs);
	};

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

	const commandOptions: CommandOption[] = useMemo(() => {
		const commands: CommandOption[] = [];

		commands.push({
			id: "nav-dashboard",
			icon: <LayoutDashboard className="text-lg" />,
			text: "Go to Documents",
			hint: "Home",
			shortcut: getShortcutForCommand("nav-dashboard"),
			group: "Navigation",
			keywords: ["home", "main", "list", "documents"],
			action: () => {
				onNavigate("dashboard");
				handleClose();
			},
		});

		commands.push({
			id: "nav-projects",
			icon: <Folder className="text-lg" />,
			text: "Go to Projects",
			hint: "Manage projects",
			shortcut: getShortcutForCommand("nav-projects"),
			group: "Navigation",
			action: () => {
				onNavigate("projects");
				handleClose();
			},
		});

		commands.push({
			id: "nav-search",
			icon: <Search className="text-lg" />,
			text: "Go to Search",
			hint: "Find documents",
			shortcut: getShortcutForCommand("nav-search"),
			group: "Navigation",
			keywords: ["find", "lookup"],
			action: () => {
				onNavigate("search");
				handleClose();
			},
		});

		commands.push({
			id: "nav-journal",
			icon: <BookOpen className="text-lg" />,
			text: "Go to Journal",
			hint: "Quick notes",
			shortcut: getShortcutForCommand("nav-journal"),
			group: "Navigation",
			keywords: ["diary", "daily", "notes", "log"],
			action: () => {
				onNavigate("journal");
				handleClose();
			},
		});

		commands.push({
			id: "nav-settings",
			icon: <Settings className="text-lg" />,
			text: "Go to Settings",
			hint: "Configure app",
			shortcut: getShortcutForCommand("nav-settings"),
			group: "Navigation",
			keywords: ["preferences", "config", "options"],
			action: () => {
				onNavigate("settings");
				handleClose();
			},
		});

		commands.push({
			id: "nav-recent",
			icon: <Clock className="text-lg" />,
			text: "Recent Documents",
			shortcut: getShortcutForCommand("nav-recent"),
			group: "Navigation",
			keywords: ["recent", "history", "opened"],
			keepOpen: true,
			action: () => {
				setShowRecentDocuments(true);
			},
		});

		commands.push({
			id: "nav-today",
			icon: <Calendar className="text-lg" />,
			text: "Jump to Today's Journal",
			shortcut: getShortcutForCommand("nav-today"),
			group: "Navigation",
			keywords: ["today", "daily", "current"],
			action: () => {
				const today = new Date().toISOString().split("T")[0];
				onNavigate("journal", { date: today });
				handleClose();
			},
		});

		commands.push({
			id: "new-document",
			icon: <FilePlus className="text-lg" />,
			text: "New Document",
			hint: "Create new entry",
			shortcut: getShortcutForCommand("new-document"),
			group: "Create",
			keywords: ["create", "add", "note"],
			action: async () => {
				handleClose();
				if (!currentProject) return;
				try {
					const newPath = await DocumentServiceWrapper.save({
						projectAlias: currentProject.alias,
						title: "Untitled",
						blocks: [
							{
								id: "initial-heading",
								type: "heading",
								props: { level: 1 },
								content: [{ type: "text", text: "", styles: {} }],
							},
						],
						tags: [],
					});
					onNavigate("document", { documentPath: newPath, newDocument: true });
				} catch (err) {
					notification.error(`Failed to create document: ${err}`);
				}
			},
		});

		if (currentPage === "document") {
			commands.push({
				id: "save-document",
				icon: <Save className="text-lg" />,
				text: "Save Document",
				shortcut: getShortcutForCommand("save-document"),
				group: "Document",
				keywords: ["save", "persist"],
				action: () => {
					handleClose();
					useDocumentCommandStore.getState().requestSave();
				},
			});
		}

		commands.push({
			id: "export-document",
			icon: <FileDown className="text-lg" />,
			text: "Export Document",
			hint: "Export to markdown",
			group: "Document",
			action: async () => {
				handleClose();

				// Get current document using the method from context
				const currentDocument = getSelectedDocument();

				if (!currentDocument?.path) {
					notification.error("No document open");
					return;
				}

				try {
					const outputDir = await OpenDirectoryDialog();
					if (!outputDir) {
						return;
					}

					const documentName =
						currentDocument.path.split("/").pop()?.replace(".json", ".md") || "document.md";
					const outputPath = `${outputDir}/${documentName}`;

					const req = new ExportDocumentRequest({
						DocumentPath: currentDocument.path,
						OutputPath: outputPath,
					});

					await ExportDocument(req);
				} catch (err) {
					notification.error(`Export failed: ${err}`);
				}
			},
		});

		commands.push({
			id: "export-document-pdf",
			icon: <FileDown className="text-lg" />,
			text: "Export Document to PDF",
			hint: "Export to PDF",
			group: "Document",
			action: async () => {
				handleClose();

				const currentDocument = getSelectedDocument();

				if (!currentDocument?.path) {
					notification.error("No document open");
					return;
				}

				try {
					const outputDir = await OpenDirectoryDialog();
					if (!outputDir) {
						return;
					}

					const documentName =
						currentDocument.path.split("/").pop()?.replace(".json", ".pdf") || "document.pdf";
					const outputPath = `${outputDir}/${documentName}`;

					const req = new ExportRequest({
						DocumentPath: currentDocument.path,
						OutputPath: outputPath,
					});

					await ExportToPDF(req);
				} catch (err) {
					notification.error(`Export failed: ${err}`);
				}
			},
		});

		commands.push({
			id: "nav-test",
			icon: <Bug className="text-lg" />,
			text: "Open Development Test",
			hint: "Debug tools",
			group: "Application",
			action: () => {
				onNavigate("test");
				handleClose();
			},
		});

		if (onToggleSidebar) {
			commands.push({
				id: "toggle-sidebar",
				icon: <PanelLeft className="text-lg" />,
				text: "Toggle Sidebar",
				shortcut: getShortcutForCommand("toggle-sidebar"),
				group: "Application",
				action: () => {
					onToggleSidebar();
					handleClose();
				},
			});
		}

		if (onShowHelp) {
			commands.push({
				id: "show-help",
				icon: <HelpCircle className="text-lg" />,
				text: "Show Keyboard Shortcuts",
				shortcut: getShortcutForCommand("show-help"),
				group: "Application",
				keywords: ["help", "shortcuts", "hotkeys", "keys"],
				action: () => {
					onShowHelp();
					handleClose();
				},
			});
		}

		commands.push({
			id: "reset-panes",
			icon: <RotateCcw className="text-lg" />,
			text: "Reset Panes",
			hint: "Single pane layout",
			group: "Application",
			keywords: ["reset", "pane", "split", "layout", "default", "single"],
			action: () => {
				resetLayout();
				handleClose();
			},
		});

		commands.push({
			id: "git-sync",
			icon: <GitCommit className="text-lg" />,
			text: "Git Sync",
			hint: "Fetch, pull, commit, push",
			shortcut: getShortcutForCommand("git-sync"),
			group: "Git",
			keywords: ["save", "backup", "commit", "push"],
			action: async () => {
				handleClose();
				try {
					const result = await SyncNow();
					if (!result) {
						notification.info("Sync completed");
						return;
					}

					switch (result.status) {
						case SyncStatus.SyncStatusNoChanges:
							notification.info(result.message || "No changes to sync");
							break;
						case SyncStatus.SyncStatusUpToDate:
							notification.info(result.message || "Already in sync with remote");
							break;
						case SyncStatus.SyncStatusCommitted:
							notification.success(result.message || `Committed ${result.filesChanged} file(s)`);
							break;
						case SyncStatus.SyncStatusSynced:
							notification.success(result.message || `Synced ${result.filesChanged} file(s) to remote`);
							break;
						case SyncStatus.SyncStatusPushFailed:
							notification.warning(result.message || "Committed locally, but push failed");
							break;
						case SyncStatus.SyncStatusConflict:
							notification.error("Merge conflict detected. Please resolve conflicts manually.");
							break;
						default:
							notification.success(result.message || "Sync completed");
					}
				} catch (err) {
					showGitError(err);
				}
			},
		});

		commands.push({
			id: "git-push",
			icon: <CloudUpload className="text-lg" />,
			text: "Git Push",
			hint: "Push to remote",
			group: "Git",
			action: async () => {
				handleClose();
				try {
					await GitPush();
					notification.success("Pushed to remote successfully");
				} catch (err) {
					showGitError(err);
				}
			},
		});

		commands.push({
			id: "git-pull",
			icon: <CloudDownload className="text-lg" />,
			text: "Git Pull",
			hint: "Pull from remote (merge)",
			group: "Git",
			action: async () => {
				handleClose();
				try {
					await GitPull();
					notification.success("Pulled from remote successfully");
				} catch (err) {
					showGitError(err);
				}
			},
		});

		if (currentProject) {
			commands.push({
				id: "export-project",
				icon: <FileDown className="text-lg" />,
				text: "Export Project",
				hint: "Export project to markdown",
				group: "Projects",
				action: async () => {
					handleClose();
					try {
						const outputDir = await OpenDirectoryDialog();
						if (!outputDir) {
							return;
						}

						const req = new ExportProjectRequest({
							ProjectAlias: currentProject.alias,
							OutputDir: outputDir,
						});

						await ExportProject(req);
					} catch (err) {
						notification.error(`Export failed: ${err}`);
					}
				},
			});
		}

		if (previousProject) {
			commands.push({
				id: "switch-last",
				icon: <ArrowLeftRight className="text-lg" />,
				text: `Switch to @${previousProject.alias}`,
				hint: previousProject.name,
				shortcut: getShortcutForCommand("switch-last"),
				group: "Projects",
				keywords: ["quick", "switch", "toggle", "last"],
				action: () => {
					switchToLastProject();
					handleClose();
				},
			});
		}

		if (currentPage === "dashboard" && onToggleArchived && currentProject) {
			commands.push({
				id: "toggle-archived",
				icon: showArchived ? <ArchiveRestore className="text-lg" /> : <Archive className="text-lg" />,
				text: showArchived ? "Hide Archived Documents" : "Show Archived Documents",
				hint: `${currentProject.alias} context`,
				group: "Projects",
				action: () => {
					onToggleArchived();
					handleClose();
				},
			});
		}

		projects
			.filter((project) => project.id !== currentProject?.id)
			.forEach((project) => {
				commands.push({
					id: `project-${project.id}`,
					icon: <ArrowRight className="text-lg" />,
					text: `Switch to ${project.alias}`,
					hint: project.name,
					group: "Projects",
					action: () => {
						setCurrentProject(project);
						handleClose();
					},
				});
			});

		return commands;
	}, [
		projects,
		currentProject,
		previousProject,
		getSelectedDocument,
		setCurrentProject,
		switchToLastProject,
		resetLayout,
		onNavigate,
		handleClose,
		currentPage,
		onToggleArchived,
		showArchived,
		onToggleSidebar,
		onShowHelp,
		notification,
		showGitError,
	]);

	// Sort commands by usage (recency + frequency) for better UX
	// Also mark the top 5 recently used commands with isRecent for visual indicator
	const sortedCommands = useMemo(() => {
		const usage = getAllCommandUsage();
		const sorted = sortCommandsByUsage(commandOptions, usage);

		// Get top 5 recently used command IDs (used within last hour)
		const recentIds = getTopRecentCommandIds(usage, 5);

		// Apply isRecent flag to commands
		return sorted.map((cmd) => ({
			...cmd,
			isRecent: recentIds.has(cmd.id),
		}));
	}, [commandOptions, getAllCommandUsage]);

	return (
		<>
			<CommandPalette
				isOpen={isOpen}
				onClose={handleClose}
				onCommandSelect={handleCommandSelect}
				commands={sortedCommands}
				placeholder="Type a command or search..."
				subPaletteItems={showRecentDocuments ? recentDocumentItems : undefined}
				subPaletteTitle={showRecentDocuments ? "Recent Documents" : undefined}
				onSubPaletteBack={handleSubPaletteBack}
			/>
			<GitErrorDialog isOpen={isErrorDialogOpen} onClose={closeErrorDialog} error={gitError} />
		</>
	);
};
