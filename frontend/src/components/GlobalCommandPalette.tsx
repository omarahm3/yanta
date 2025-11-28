import type React from "react";
import { useMemo, useState } from "react";
import {
	RiArchiveLine,
	RiArrowRightLine,
	RiBugLine,
	RiDashboardLine,
	RiDownloadCloudLine,
	RiFileAddLine,
	RiFolderLine,
	RiGitCommitLine,
	RiInboxUnarchiveLine,
	RiSearchLine,
	RiSettings3Line,
	RiUploadCloudLine,
} from "react-icons/ri";
import { SyncStatus } from "../../bindings/yanta/internal/git/models";
import { GitPull, GitPush, SyncNow } from "../../bindings/yanta/internal/system/service";
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
			icon: <RiDashboardLine className="text-lg" />,
			text: "Go to Dashboard",
			hint: "Home",
			action: () => {
				onNavigate("dashboard");
				onClose();
			},
		});

		commands.push({
			id: "nav-projects",
			icon: <RiFolderLine className="text-lg" />,
			text: "Go to Projects",
			hint: "Manage projects",
			action: () => {
				onNavigate("projects");
				onClose();
			},
		});

		commands.push({
			id: "nav-search",
			icon: <RiSearchLine className="text-lg" />,
			text: "Go to Search",
			hint: "Find documents",
			action: () => {
				onNavigate("search");
				onClose();
			},
		});

		commands.push({
			id: "nav-settings",
			icon: <RiSettings3Line className="text-lg" />,
			text: "Go to Settings",
			hint: "Configure app",
			action: () => {
				onNavigate("settings");
				onClose();
			},
		});

		commands.push({
			id: "new-document",
			icon: <RiFileAddLine className="text-lg" />,
			text: "New Document",
			hint: "Create new entry",
			action: () => {
				onNavigate("document");
				onClose();
			},
		});

		commands.push({
			id: "nav-test",
			icon: <RiBugLine className="text-lg" />,
			text: "Open Development Test",
			hint: "Debug tools",
			action: () => {
				onNavigate("test");
				onClose();
			},
		});

		commands.push({
			id: "git-sync",
			icon: <RiGitCommitLine className="text-lg" />,
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
			icon: <RiUploadCloudLine className="text-lg" />,
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
			icon: <RiDownloadCloudLine className="text-lg" />,
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

		if (currentPage === "dashboard" && onToggleArchived && currentProject) {
			commands.push({
				id: "toggle-archived",
				icon: showArchived ? (
					<RiInboxUnarchiveLine className="text-lg" />
				) : (
					<RiArchiveLine className="text-lg" />
				),
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
					icon: <RiArrowRightLine className="text-lg" />,
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
