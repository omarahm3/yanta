import { useCallback, useEffect, useState } from "react";
import { SyncStatus } from "../../bindings/yanta/internal/git/models";
import {
	CheckGitInstalled,
	GetCurrentDataDirectory,
	GetCurrentGitBranch,
	GetDataDirectoryEnvVar,
	GetGitBranches,
	GetGitSyncConfig,
	IsDataDirectoryOverridden,
	SetGitSyncConfig,
	SyncNow,
} from "../../bindings/yanta/internal/system/service";
import { useNotification } from "../shared/hooks";
import { recordCommandInFlightDelta } from "../shared/monitoring/appMonitor";
import type { SelectOption } from "../shared/ui";
import { BackendLogger } from "../shared/utils/backendLogger";

export interface GitSyncSettings {
	enabled: boolean;
	commitInterval: number;
	autoPush: boolean;
	branch: string;
}

const commitIntervalOptions: SelectOption[] = [
	{ value: "5", label: "Every 5 minutes" },
	{ value: "10", label: "Every 10 minutes" },
	{ value: "15", label: "Every 15 minutes" },
	{ value: "30", label: "Every 30 minutes" },
	{ value: "60", label: "Every hour" },
	{ value: "0", label: "Manual only" },
];

export function useGitSyncSettings() {
	const [gitInstalled, setGitInstalled] = useState(true);
	const [currentDataDir, setCurrentDataDir] = useState("");
	const [dataDirOverridden, setDataDirOverridden] = useState(false);
	const [dataDirEnvVar, setDataDirEnvVar] = useState("");
	const [gitSync, setGitSync] = useState<GitSyncSettings>({
		enabled: false,
		commitInterval: 10,
		autoPush: true,
		branch: "",
	});
	const [gitBranches, setGitBranches] = useState<string[]>([]);
	const [currentGitBranch, setCurrentGitBranch] = useState<string>("");
	const [syncNowInFlight, setSyncNowInFlight] = useState(false);
	const { success, error, info, warning } = useNotification();

	useEffect(() => {
		CheckGitInstalled()
			.then((installed) => setGitInstalled(installed))
			.catch(() => setGitInstalled(false));

		GetCurrentDataDirectory()
			.then((dir) => setCurrentDataDir(dir))
			.catch((err) => BackendLogger.error("Failed to get current data directory:", err));

		IsDataDirectoryOverridden()
			.then((overridden) => setDataDirOverridden(overridden))
			.catch((err) => BackendLogger.error("Failed to check data directory override:", err));

		GetDataDirectoryEnvVar()
			.then((envVar) => setDataDirEnvVar(envVar))
			.catch((err) => BackendLogger.error("Failed to get data directory env var:", err));

		GetGitSyncConfig()
			.then((config) => {
				setGitSync({
					enabled: config.Enabled,
					commitInterval: config.CommitInterval || 10,
					autoPush: config.AutoPush !== undefined ? config.AutoPush : true,
					branch: config.Branch || "",
				});
			})
			.catch((err) => BackendLogger.error("Failed to get git sync config:", err));

		GetGitBranches()
			.then((branches) => setGitBranches(branches || []))
			.catch((err) => BackendLogger.error("Failed to get git branches:", err));

		GetCurrentGitBranch()
			.then((branch) => setCurrentGitBranch(branch || ""))
			.catch((err) => BackendLogger.error("Failed to get current git branch:", err));
	}, []);

	const handleGitSyncToggle = useCallback(
		async (enabled: boolean) => {
			try {
				const config = {
					Enabled: enabled,
					AutoCommit: gitSync.commitInterval > 0,
					AutoPush: gitSync.autoPush,
					CommitInterval: gitSync.commitInterval,
					Branch: gitSync.branch,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, enabled }));
			} catch (err) {
				error(`Failed to update git sync: ${err}`);
			}
		},
		[error, gitSync],
	);

	const handleCommitIntervalChange = useCallback(
		async (interval: number) => {
			try {
				const config = {
					Enabled: gitSync.enabled,
					AutoCommit: interval > 0,
					AutoPush: gitSync.autoPush,
					CommitInterval: interval,
					Branch: gitSync.branch,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, commitInterval: interval }));
			} catch (err) {
				error(`Failed to update commit interval: ${err}`);
			}
		},
		[gitSync, error],
	);

	const handleAutoPushToggle = useCallback(
		async (enabled: boolean) => {
			try {
				const config = {
					Enabled: gitSync.enabled,
					AutoCommit: gitSync.commitInterval > 0,
					AutoPush: enabled,
					CommitInterval: gitSync.commitInterval,
					Branch: gitSync.branch,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, autoPush: enabled }));
			} catch (err) {
				error(`Failed to update auto-push: ${err}`);
			}
		},
		[gitSync, error],
	);

	const handleBranchChange = useCallback(
		async (branch: string) => {
			try {
				const config = {
					Enabled: gitSync.enabled,
					AutoCommit: gitSync.commitInterval > 0,
					AutoPush: gitSync.autoPush,
					CommitInterval: gitSync.commitInterval,
					Branch: branch,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, branch }));
			} catch (err) {
				error(`Failed to update sync branch: ${err}`);
			}
		},
		[gitSync, error],
	);

	const handleSyncNow = useCallback(async () => {
		if (syncNowInFlight) {
			info("Sync is already in progress");
			return;
		}
		setSyncNowInFlight(true);
		recordCommandInFlightDelta("syncNow", 1);
		try {
			const result = await SyncNow();
			if (!result) {
				info("Sync completed");
				return;
			}
			switch (result.status) {
				case SyncStatus.SyncStatusNoChanges:
					info(result.message || "No changes to sync");
					break;
				case SyncStatus.SyncStatusUpToDate:
					info(result.message || "Already in sync with remote");
					break;
				case SyncStatus.SyncStatusCommitted:
					success(result.message || `Committed ${result.filesChanged} file(s)`);
					break;
				case SyncStatus.SyncStatusSynced:
					success(result.message || `Synced ${result.filesChanged} file(s) to remote`);
					break;
				case SyncStatus.SyncStatusPushFailed:
					warning(result.message || "Committed locally, but push failed");
					break;
				case SyncStatus.SyncStatusConflict:
					error("Merge conflict detected. Please resolve conflicts manually.");
					break;
				default:
					success(result.message || "Sync completed");
			}
		} catch (err) {
			const errorMessage = String(err);
			const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
			error(`Sync failed:\n\n${cleanedMessage}`);
		} finally {
			recordCommandInFlightDelta("syncNow", -1);
			setSyncNowInFlight(false);
		}
	}, [syncNowInFlight, success, error, info, warning]);

	return {
		gitInstalled,
		currentDataDir,
		dataDirOverridden,
		dataDirEnvVar,
		gitSync,
		gitBranches,
		currentGitBranch,
		commitIntervalOptions,
		handleGitSyncToggle,
		handleCommitIntervalChange,
		handleAutoPushToggle,
		handleBranchChange,
		handleSyncNow,
		syncNowInFlight,
	};
}
