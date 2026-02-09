import { CloudDownload, CloudUpload, GitCommit } from "lucide-react";
import { SyncStatus } from "../../../../bindings/yanta/internal/git/models";
import { GitPull, GitPush, SyncNow } from "../../../../bindings/yanta/internal/system/service";
import type { CommandOption } from "../../../components/ui";
import { getShortcutForCommand } from "../../../utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerGitCommands(registry: CommandRegistry, ctx: CommandRegistryContext): void {
	const { handleClose, notification, showGitError } = ctx;
	const commands: CommandOption[] = [
		{
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
		},
		{
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
		},
		{
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
		},
	];
	registry.setCommands("git", commands);
}
