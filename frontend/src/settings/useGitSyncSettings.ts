import { useCallback, useEffect, useRef, useState } from "react";
import { SyncStatus } from "../../bindings/yanta/internal/git/models";
import {
	CheckGitInstalled,
	GetAppHomeEnvVar,
	GetCurrentDataDirectory,
	GetCurrentGitBranch,
	GetGitBranches,
	GetGitSyncConfig,
	IsDataDirectoryOverridden,
	SetGitSyncConfig,
} from "../../bindings/yanta/internal/system/service";
import { useNotification } from "../shared/hooks";
import { useSyncStore } from "../shared/stores/sync.store";
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
	const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
	const [isLoadingSettings, setIsLoadingSettings] = useState(false);
	const loadingRef = useRef(false);
	const syncNowInFlight = useSyncStore((s) => s.inProgress);
	const lastSync = useSyncStore((s) => s.lastSynced);
	const { success, error, info, warning } = useNotification();

	const loadSettings = useCallback(async () => {
		// Guard against overlapping loads (e.g. rapid Retry clicks) racing on setters.
		if (loadingRef.current) return;
		loadingRef.current = true;
		setIsLoadingSettings(true);
		setSettingsLoadError(null);
		const errors: string[] = [];

		try {
			// Resolve git availability first — it gates the branch lookups below.
			let gitInstalled = false;
			await CheckGitInstalled()
				.then((installed) => {
					gitInstalled = installed;
					setGitInstalled(installed);
				})
				.catch(() => setGitInstalled(false));

			// These calls are independent, so run them concurrently.
			const tasks: Promise<void>[] = [
				GetCurrentDataDirectory()
					.then((dir) => setCurrentDataDir(dir))
					.catch((err) => {
						BackendLogger.error("Failed to get current data directory:", err);
						errors.push("data directory");
					}),
				IsDataDirectoryOverridden()
					.then((overridden) => setDataDirOverridden(overridden))
					.catch((err) => {
						BackendLogger.error("Failed to check data directory override:", err);
						errors.push("override check");
					}),
				GetAppHomeEnvVar()
					.then((envVar) => setDataDirEnvVar(envVar))
					.catch((err) => {
						BackendLogger.error("Failed to get data directory env var:", err);
						errors.push("env var");
					}),
				GetGitSyncConfig()
					.then((config) => {
						setGitSync({
							enabled: config.Enabled,
							commitInterval: config.CommitInterval,
							autoPush: config.AutoPush,
							branch: config.Branch || "",
						});
					})
					.catch((err) => {
						BackendLogger.error("Failed to get git sync config:", err);
						errors.push("sync config");
					}),
			];

			// Branch lookups only make sense when git is installed; running them
			// otherwise just fails and surfaces a misleading "Couldn't load settings"
			// next to the "Git not installed" warning.
			if (gitInstalled) {
				tasks.push(
					GetGitBranches()
						.then((branches) => setGitBranches(branches || []))
						.catch((err) => {
							BackendLogger.error("Failed to get git branches:", err);
							errors.push("branches");
						}),
					GetCurrentGitBranch()
						.then((branch) => setCurrentGitBranch(branch || ""))
						.catch((err) => {
							BackendLogger.error("Failed to get current git branch:", err);
							errors.push("current branch");
						}),
				);
			}

			await Promise.all(tasks);

			if (errors.length > 0) {
				setSettingsLoadError(`Failed to load: ${errors.join(", ")}`);
			}
		} finally {
			setIsLoadingSettings(false);
			loadingRef.current = false;
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	const handleGitSyncToggle = useCallback(
		async (enabled: boolean) => {
			try {
				// Enabling Git Sync should actually sync. If the user hasn't
				// picked an interval yet, default to auto-commit every 10 min and
				// auto-push, so enabling isn't a silent no-op (commit locally,
				// never push). They can switch to "Manual only" or turn off
				// auto-push afterwards.
				const commitInterval = enabled && gitSync.commitInterval <= 0 ? 10 : gitSync.commitInterval;
				const autoPush = enabled ? true : gitSync.autoPush;
				const config = {
					Enabled: enabled,
					AutoCommit: commitInterval > 0,
					AutoPush: autoPush,
					CommitInterval: commitInterval,
					Branch: gitSync.branch,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, enabled, commitInterval, autoPush }));
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
		try {
			const result = await useSyncStore.getState().syncNow();
			if (result === undefined) {
				return;
			}
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
			error(String(err));
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
		lastSync,
		settingsLoadError,
		isLoadingSettings,
		retryLoadSettings: loadSettings,
	};
}
