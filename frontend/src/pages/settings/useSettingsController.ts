import { useCallback, useEffect, useState } from "react";
import { Events } from "@wailsio/runtime";
import { SyncStatus } from "../../../bindings/yanta/internal/git/models";
import {
	CheckGitInstalled,
	GetAppScale,
	GetCurrentDataDirectory,
	GetGitSyncConfig,
	GetKeepInBackground,
	GetStartHidden,
	GetSystemInfo,
	MigrateToGitDirectory,
	OpenDirectoryDialog,
	ReindexDatabase,
	SetAppScale,
	SetGitSyncConfig,
	SetKeepInBackground,
	SetLogLevel,
	SetStartHidden,
	SyncNow,
	ValidateMigrationTarget,
} from "../../../bindings/yanta/internal/system/service";
import { GetWindowMode, SetWindowMode } from "../../../bindings/yanta/internal/window/service";
import type { SelectOption } from "../../components/ui";
import { useScale } from "../../contexts";
import { useNotification } from "../../hooks/useNotification";
import { type SystemInfo, systemInfoFromModel } from "../../types";

interface GitSyncSettings {
	enabled: boolean;
	repositoryPath: string;
	syncFrequency: string;
	autoPush: boolean;
}

export const useSettingsController = () => {
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [needsRestart, setNeedsRestart] = useState(false);
	const [keepInBackground, setKeepInBackgroundState] = useState(false);
	const [startHidden, setStartHiddenState] = useState(false);
	const [gitInstalled, setGitInstalled] = useState(true);
	const [currentDataDir, setCurrentDataDir] = useState("");
	const [migrationTarget, setMigrationTarget] = useState("");
	const [isMigrating, setIsMigrating] = useState(false);
	const [migrationProgress, setMigrationProgress] = useState("");
	const [gitSync, setGitSync] = useState<GitSyncSettings>({
		enabled: false,
		repositoryPath: "",
		syncFrequency: "daily",
		autoPush: true,
	});
	const [linuxWindowMode, setLinuxWindowModeState] = useState<string>("normal");
	const [isReindexing, setIsReindexing] = useState(false);
	const [reindexProgress, setReindexProgress] = useState<{
		current: number;
		total: number;
		message: string;
	} | null>(null);
	const [showReindexConfirm, setShowReindexConfirm] = useState(false);
	const [appScale, setAppScaleState] = useState<number>(1.0);

	const { success, error, info, warning } = useNotification();
	const { setScale } = useScale();

	useEffect(() => {
		GetSystemInfo()
			.then((model) => {
				if (model) {
					setSystemInfo(systemInfoFromModel(model));
				}
			})
			.catch((err) => console.error("Failed to fetch system info:", err));

		GetKeepInBackground()
			.then((value) => setKeepInBackgroundState(value))
			.catch((err) => console.error("Failed to fetch keep in background setting:", err));

		GetStartHidden()
			.then((value) => setStartHiddenState(value))
			.catch((err) => console.error("Failed to fetch start hidden setting:", err));

		CheckGitInstalled()
			.then((installed) => setGitInstalled(installed))
			.catch(() => setGitInstalled(false));

		GetCurrentDataDirectory()
			.then((dir) => setCurrentDataDir(dir))
			.catch((err) => console.error("Failed to get current data directory:", err));

		GetGitSyncConfig()
			.then((config) => {
				setGitSync({
					enabled: config.Enabled,
					repositoryPath: config.RepositoryPath,
					syncFrequency: config.AutoCommit ? "realtime" : "manual",
					autoPush: config.AutoPush !== undefined ? config.AutoPush : true,
				});
			})
			.catch((err) => console.error("Failed to get git sync config:", err));

		GetWindowMode()
			.then((mode) => setLinuxWindowModeState(mode))
			.catch((err) => console.error("Failed to get window mode:", err));

		GetAppScale()
			.then((scale) => setAppScaleState(scale))
			.catch((err) => console.error("Failed to get app scale:", err));

		const unsubscribe = Events.On("reindex:progress", (data: unknown) => {
			const progressData = data as { current: number; total: number; message: string };
			setReindexProgress({
				current: progressData.current,
				total: progressData.total,
				message: progressData.message,
			});
		});

		return () => {
			unsubscribe();
		};
	}, []);

	const handleLogLevelChange = useCallback(
		async (level: string) => {
			try {
				await SetLogLevel(level);
				setNeedsRestart(true);
				success(`Log level set to ${level}. Please restart the application.`);

				const model = await GetSystemInfo();
				if (model) {
					setSystemInfo(systemInfoFromModel(model));
				}
			} catch (err) {
				error(`Failed to set log level: ${err}`);
			}
		},
		[success, error],
	);

	const handleKeepInBackgroundToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await SetKeepInBackground(enabled);
				setKeepInBackgroundState(enabled);
				if (!enabled) {
					setStartHiddenState(false);
				}
				success(
					enabled ? "Window will hide to background when closed" : "Window will quit when closed",
				);
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[success, error],
	);

	const handleStartHiddenToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await SetStartHidden(enabled);
				setStartHiddenState(enabled);
				success(enabled ? "App will start hidden in background" : "App will start with window visible");
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[success, error],
	);

	const handleLinuxWindowModeToggle = useCallback(
		async (frameless: boolean) => {
			try {
				const mode = frameless ? "frameless" : "normal";
				await SetWindowMode(mode);
				setLinuxWindowModeState(mode);
				setNeedsRestart(true);
				success(
					frameless
						? "Frameless mode enabled. Please restart the application."
						: "Normal window mode enabled. Please restart the application.",
				);
			} catch (err) {
				error(`Failed to update window mode: ${err}`);
			}
		},
		[success, error],
	);

	const handleAppScaleChange = useCallback(
		async (scale: number) => {
			try {
				await SetAppScale(scale);
				setAppScaleState(scale);
				setScale(scale);
				success(`App scale set to ${Math.round(scale * 100)}%`);
			} catch (err) {
				error(`Failed to set app scale: ${err}`);
			}
		},
		[setScale, success, error],
	);

	const handleGitSyncToggle = useCallback(
		async (enabled: boolean) => {
			try {
				const config = {
					Enabled: enabled,
					RepositoryPath: gitSync.repositoryPath,
					AutoCommit: gitSync.syncFrequency === "realtime",
					AutoPush: gitSync.autoPush,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, enabled }));
				success(enabled ? "Git sync enabled" : "Git sync disabled");
			} catch (err) {
				error(`Failed to update git sync: ${err}`);
			}
		},
		[success, error, gitSync],
	);

	const handleSyncFrequencyChange = useCallback(
		async (frequency: string) => {
			try {
				const config = {
					Enabled: gitSync.enabled,
					RepositoryPath: gitSync.repositoryPath,
					AutoCommit: frequency === "realtime",
					AutoPush: gitSync.autoPush,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, syncFrequency: frequency }));
				success("Sync frequency updated");
			} catch (err) {
				error(`Failed to update sync frequency: ${err}`);
			}
		},
		[gitSync, success, error],
	);

	const handleAutoPushToggle = useCallback(
		async (enabled: boolean) => {
			try {
				const config = {
					Enabled: gitSync.enabled,
					RepositoryPath: gitSync.repositoryPath,
					AutoCommit: gitSync.syncFrequency === "realtime",
					AutoPush: enabled,
				};
				await SetGitSyncConfig(config);
				setGitSync((prev) => ({ ...prev, autoPush: enabled }));
				success(enabled ? "Auto-push enabled" : "Auto-push disabled");
			} catch (err) {
				error(`Failed to update auto-push: ${err}`);
			}
		},
		[gitSync, success, error],
	);

	const handlePickDirectory = useCallback(async () => {
		try {
			const selected = await OpenDirectoryDialog();
			if (selected) {
				setMigrationTarget(selected);
			}
		} catch (err) {
			error(`Failed to open directory picker: ${err}`);
		}
	}, [error]);

	const handleMigration = useCallback(async () => {
		if (!migrationTarget) {
			error("Please enter a target directory");
			return;
		}

		try {
			setIsMigrating(true);
			setMigrationProgress("Validating target directory...");

			await ValidateMigrationTarget(migrationTarget);

			setMigrationProgress("Migrating data...");
			await MigrateToGitDirectory(migrationTarget);

			setMigrationProgress("Migration complete! App will exit in 2 seconds...");
			success("Migration completed! Please restart YANTA to use the new location.");
		} catch (err) {
			const errorMessage = String(err);
			const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
			error(`Migration failed:\n\n${cleanedMessage}`);
			setIsMigrating(false);
			setMigrationProgress("");
		}
	}, [migrationTarget, success, error]);

	const handleSyncNow = useCallback(async () => {
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
		}
	}, [success, error, info, warning]);

	const handleRequestReindex = useCallback(() => {
		setShowReindexConfirm(true);
	}, []);

	const handleConfirmReindex = useCallback(async () => {
		try {
			setShowReindexConfirm(false);
			setIsReindexing(true);
			setReindexProgress({ current: 0, total: 0, message: "Starting..." });

			await ReindexDatabase();

			success("Database reindexed successfully");
			setReindexProgress(null);
		} catch (err) {
			const errorMessage = String(err);
			const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
			error(`Reindex failed:\n\n${cleanedMessage}`);
			setReindexProgress(null);
		} finally {
			setIsReindexing(false);
		}
	}, [success, error]);

	const handleCancelReindex = useCallback(() => {
		setShowReindexConfirm(false);
	}, []);

	const logLevelOptions: SelectOption[] = [
		{ value: "debug", label: "Debug" },
		{ value: "info", label: "Info" },
		{ value: "warn", label: "Warning" },
		{ value: "error", label: "Error" },
	];

	const syncFrequencyOptions: SelectOption[] = [
		{ value: "realtime", label: "Auto-commit (after every save)" },
		{ value: "manual", label: "Manual sync only" },
	];

	return {
		systemInfo,
		needsRestart,
		keepInBackground,
		startHidden,
		linuxWindowMode,
		gitInstalled,
		currentDataDir,
		migrationTarget,
		setMigrationTarget,
		isMigrating,
		migrationProgress,
		gitSync,
		isReindexing,
		reindexProgress,
		showReindexConfirm,
		appScale,
		logLevelOptions,
		syncFrequencyOptions,
		handlers: {
			handleLogLevelChange,
			handleKeepInBackgroundToggle,
			handleStartHiddenToggle,
			handleLinuxWindowModeToggle,
			handleAppScaleChange,
			handleGitSyncToggle,
			handleSyncFrequencyChange,
			handleAutoPushToggle,
			handlePickDirectory,
			handleMigration,
			handleSyncNow,
			handleRequestReindex,
			handleConfirmReindex,
			handleCancelReindex,
		},
	};
};
