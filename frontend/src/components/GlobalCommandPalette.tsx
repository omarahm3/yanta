import {
	Archive,
	ArchiveRestore,
	ArrowRight,
	Bug,
	CloudDownload,
	CloudUpload,
	FileDown,
	FilePlus,
	Folder,
	GitCommit,
	LayoutDashboard,
	Search,
	Settings,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
	ExportDocumentRequest,
	ExportProjectRequest,
} from "../../bindings/yanta/internal/document/models";
import { ExportDocument, ExportProject } from "../../bindings/yanta/internal/document/service";
import { SyncStatus } from "../../bindings/yanta/internal/git/models";
import {
	GitPull,
	GitPush,
	OpenDirectoryDialog,
	SyncNow,
} from "../../bindings/yanta/internal/system/service";
import { useDocumentContext } from "../contexts/DocumentContext";
import { useProjectContext } from "../contexts/ProjectContext";
import { useNotification } from "../hooks/useNotification";
import { type ParsedGitError, parseGitError } from "../utils/gitErrorParser";
import { type CommandOption, CommandPalette, GitErrorDialog } from "./ui";

interface GlobalCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onNavigate: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	currentPage?: string;
	onToggleArchived?: () => void;
	showArchived?: boolean;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
	isOpen,
	onClose,
	onNavigate,
	currentPage,
	onToggleArchived,
	showArchived,
}) => {
	const { projects, currentProject, setCurrentProject } = useProjectContext();
	const { getSelectedDocument } = useDocumentContext();
	const notification = useNotification();
	const [gitError, setGitError] = useState<ParsedGitError | null>(null);
	const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

	const showGitError = (error: unknown) => {
		const parsed = parseGitError(error);
		setGitError(parsed);
		setIsErrorDialogOpen(true);
	};

	const closeErrorDialog = () => {
		setIsErrorDialogOpen(false);
		setTimeout(() => setGitError(null), 300);
	};

	const commandOptions: CommandOption[] = useMemo(() => {
		const commands: CommandOption[] = [];

		commands.push({
			id: "nav-dashboard",
			icon: <LayoutDashboard className="text-lg" />,
			text: "Go to Dashboard",
			hint: "Home",
			action: () => {
				onNavigate("dashboard");
				onClose();
			},
		});

		commands.push({
			id: "nav-projects",
			icon: <Folder className="text-lg" />,
			text: "Go to Projects",
			hint: "Manage projects",
			action: () => {
				onNavigate("projects");
				onClose();
			},
		});

		commands.push({
			id: "nav-search",
			icon: <Search className="text-lg" />,
			text: "Go to Search",
			hint: "Find documents",
			action: () => {
				onNavigate("search");
				onClose();
			},
		});

		commands.push({
			id: "nav-settings",
			icon: <Settings className="text-lg" />,
			text: "Go to Settings",
			hint: "Configure app",
			action: () => {
				onNavigate("settings");
				onClose();
			},
		});

		commands.push({
			id: "new-document",
			icon: <FilePlus className="text-lg" />,
			text: "New Document",
			hint: "Create new entry",
			action: () => {
				onNavigate("document");
				onClose();
			},
		});

		commands.push({
			id: "export-document",
			icon: <FileDown className="text-lg" />,
			text: "Export Document",
			hint: "Export to markdown",
			action: async () => {
				onClose();

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
					notification.success(`Exported to ${outputPath}`);
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
			action: () => {
				onNavigate("test");
				onClose();
			},
		});

		commands.push({
			id: "git-sync",
			icon: <GitCommit className="text-lg" />,
			text: "Git Sync",
			hint: "Fetch, pull, commit, push",
			action: async () => {
				onClose();
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
			action: async () => {
				onClose();
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
			action: async () => {
				onClose();
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
				action: async () => {
					onClose();
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
						notification.success(`Exported project to ${outputDir}`);
					} catch (err) {
						notification.error(`Export failed: ${err}`);
					}
				},
			});
		}

		if (currentPage === "dashboard" && onToggleArchived && currentProject) {
			commands.push({
				id: "toggle-archived",
				icon: showArchived ? <ArchiveRestore className="text-lg" /> : <Archive className="text-lg" />,
				text: showArchived ? "Hide Archived Documents" : "Show Archived Documents",
				hint: `${currentProject.alias} context`,
				action: () => {
					onToggleArchived();
					onClose();
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
					action: () => {
						setCurrentProject(project);
						onClose();
					},
				});
			});

		return commands;
	}, [
		projects,
		currentProject,
		getSelectedDocument,
		setCurrentProject,
		onNavigate,
		onClose,
		currentPage,
		onToggleArchived,
		showArchived,
		notification,
		showGitError,
	]);

	return (
		<>
			<CommandPalette
				isOpen={isOpen}
				onClose={onClose}
				onCommandSelect={() => {}}
				commands={commandOptions}
				placeholder="Type a command or search..."
			/>
			<GitErrorDialog isOpen={isErrorDialogOpen} onClose={closeErrorDialog} error={gitError} />
		</>
	);
};
