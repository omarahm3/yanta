import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useState } from "react";
import type { BackupInfo } from "../../../bindings/yanta/internal/backup/models";
import {
	Delete as DeleteBackup,
	GetConfig as GetBackupConfig,
	GetBackups,
	Restore as RestoreBackup,
	SetConfig as SetBackupConfig,
} from "../../../bindings/yanta/internal/backup/service";
import type { BackupConfig } from "../../../bindings/yanta/internal/config/models";
import { SyncStatus } from "../../../bindings/yanta/internal/git/models";
import type { MigrationConflictInfo } from "../../../bindings/yanta/internal/migration/models";
import { MigrationStrategy } from "../../../bindings/yanta/internal/migration/models";
import {
	CheckGitInstalled,
	CheckMigrationConflicts,
	GetAppScale,
	GetCurrentDataDirectory,
	GetCurrentGitBranch,
	GetDataDirectoryEnvVar,
	GetGitBranches,
	GetGitSyncConfig,
	GetHotkeyConfig,
	GetKeepInBackground,
	GetPlatform,
	GetStartHidden,
	GetSystemInfo,
	IsDataDirectoryOverridden,
	MigrateToGitDirectory,
	OpenDirectoryDialog,
	ReindexDatabase,
	SetAppScale,
	SetGitSyncConfig,
	SetHotkeyConfig,
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
import {
	type GlobalHotkeyConfig,
	globalHotkeyConfigFromModel,
	globalHotkeyConfigToModel,
	type SystemInfo,
	systemInfoFromModel,
} from "../../types";
import { BackendLogger } from "../../utils/backendLogger";

interface GitSyncSettings {
	enabled: boolean;
	commitInterval: number; // minutes, 0 = manual only
	autoPush: boolean;
	branch: string; // empty = use current branch
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
	const [dataDirOverridden, setDataDirOverridden] = useState(false);
	const [dataDirEnvVar, setDataDirEnvVar] = useState("");
	const [gitSync, setGitSync] = useState<GitSyncSettings>({
		enabled: false,
		commitInterval: 10, // default 10 minutes
		autoPush: true,
		branch: "", // empty = use current branch
	});
	const [gitBranches, setGitBranches] = useState<string[]>([]);
	const [currentGitBranch, setCurrentGitBranch] = useState<string>("");
	const [linuxWindowMode, setLinuxWindowModeState] = useState<string>("normal");
	const [isReindexing, setIsReindexing] = useState(false);
	const [reindexProgress, setReindexProgress] = useState<{
		current: number;
		total: number;
		message: string;
	} | null>(null);
	const [showReindexConfirm, setShowReindexConfirm] = useState(false);
	const [appScale, setAppScaleState] = useState<number>(1.0);
	const [backupConfig, setBackupConfig] = useState<BackupConfig>({
		Enabled: false,
		MaxBackups: 5,
	});
	const [backups, setBackups] = useState<BackupInfo[]>([]);
	const [hotkeyConfig, setHotkeyConfigState] = useState<GlobalHotkeyConfig>({
		quickCaptureEnabled: false,
		quickCaptureHotkey: "Ctrl+Shift+N",
	});
	const [hotkeyError, setHotkeyError] = useState<string | undefined>();
	const [platform, setPlatform] = useState<string>("");
	const [conflictInfo, setConflictInfo] = useState<MigrationConflictInfo | null>(null);
	const [showConflictDialog, setShowConflictDialog] = useState(false);

	const { success, error, info, warning } = useNotification();
	const { setScale } = useScale();

	useEffect(() => {
		GetSystemInfo()
			.then((model) => {
				if (model) {
					setSystemInfo(systemInfoFromModel(model));
				}
			})
			.catch((err) => BackendLogger.error("Failed to fetch system info:", err));

		GetKeepInBackground()
			.then((value) => setKeepInBackgroundState(value))
			.catch((err) => BackendLogger.error("Failed to fetch keep in background setting:", err));

		GetStartHidden()
			.then((value) => setStartHiddenState(value))
			.catch((err) => BackendLogger.error("Failed to fetch start hidden setting:", err));

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

		GetWindowMode()
			.then((mode) => setLinuxWindowModeState(mode))
			.catch((err) => BackendLogger.error("Failed to get window mode:", err));

		GetAppScale()
			.then((scale) => setAppScaleState(scale))
			.catch((err) => BackendLogger.error("Failed to get app scale:", err));

		GetBackupConfig()
			.then((config) => setBackupConfig(config))
			.catch((err) => BackendLogger.error("Failed to get backup config:", err));

		GetBackups()
			.then((backupList) => setBackups(backupList))
			.catch((err) => BackendLogger.error("Failed to get backups:", err));

		// Fetch hotkey configuration
		GetPlatform()
			.then((p) => setPlatform(p))
			.catch((err) => BackendLogger.error("Failed to get platform:", err));

		GetHotkeyConfig()
			.then((config) => {
				setHotkeyConfigState(globalHotkeyConfigFromModel(config));
			})
			.catch((err) => BackendLogger.error("Failed to get hotkey config:", err));

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
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[error],
	);

	const handleStartHiddenToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await SetStartHidden(enabled);
				setStartHiddenState(enabled);
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[error],
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
			} catch (err) {
				error(`Failed to set app scale: ${err}`);
			}
		},
		[setScale, error],
	);

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

	const performMigration = useCallback(
		async (strategy: MigrationStrategy) => {
			try {
				setIsMigrating(true);
				setMigrationProgress("Migrating data...");

				await MigrateToGitDirectory(migrationTarget, strategy);

				setMigrationProgress("Migration complete! App will exit in 2 seconds...");
				success("Migration completed! Please restart YANTA to use the new location.");
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				error(`Migration failed:\n\n${cleanedMessage}`);
				setIsMigrating(false);
				setMigrationProgress("");
			}
		},
		[migrationTarget, success, error],
	);

	const handleMigration = useCallback(async () => {
		if (!migrationTarget) {
			error("Please enter a target directory");
			return;
		}

		try {
			setIsMigrating(true);
			setMigrationProgress("Validating target directory...");

			await ValidateMigrationTarget(migrationTarget);

			setMigrationProgress("Checking for conflicts...");
			const conflict = await CheckMigrationConflicts(migrationTarget);

			if (conflict?.hasConflict) {
				// Show conflict dialog and wait for user decision
				setConflictInfo(conflict);
				setShowConflictDialog(true);
				setIsMigrating(false);
				setMigrationProgress("");
				return;
			}

			// No conflict - proceed with default strategy
			await performMigration(MigrationStrategy.StrategyUseRemote);
		} catch (err) {
			const errorMessage = String(err);
			const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
			error(`Migration failed:\n\n${cleanedMessage}`);
			setIsMigrating(false);
			setMigrationProgress("");
		}
	}, [migrationTarget, error, performMigration]);

	const handleConflictConfirm = useCallback(
		async (strategy: MigrationStrategy) => {
			setShowConflictDialog(false);
			await performMigration(strategy);
		},
		[performMigration],
	);

	const handleConflictCancel = useCallback(() => {
		setShowConflictDialog(false);
		setConflictInfo(null);
	}, []);

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

	const handleBackupToggle = useCallback(
		async (enabled: boolean) => {
			try {
				const config = {
					Enabled: enabled,
					MaxBackups: backupConfig.MaxBackups,
				};
				await SetBackupConfig(config);
				setBackupConfig(config);
			} catch (err) {
				error(`Failed to update backup config: ${err}`);
			}
		},
		[backupConfig, error],
	);

	const handleMaxBackupsChange = useCallback(
		async (value: number) => {
			try {
				const config = {
					Enabled: backupConfig.Enabled,
					MaxBackups: value,
				};
				await SetBackupConfig(config);
				setBackupConfig(config);
			} catch (err) {
				error(`Failed to update max backups: ${err}`);
			}
		},
		[backupConfig, error],
	);

	const handleRestoreBackup = useCallback(
		async (backupPath: string) => {
			try {
				await RestoreBackup(backupPath);
				success("Backup restored successfully. Please restart the application.");
				setNeedsRestart(true);
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				error(`Restore failed:\n\n${cleanedMessage}`);
			}
		},
		[success, error],
	);

	const handleDeleteBackup = useCallback(
		async (backupPath: string) => {
			try {
				await DeleteBackup(backupPath);
				// Refresh backups list
				const backupList = await GetBackups();
				setBackups(backupList);
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				error(`Delete failed:\n\n${cleanedMessage}`);
			}
		},
		[error],
	);

	const handleHotkeyConfigChange = useCallback(
		async (config: GlobalHotkeyConfig) => {
			// Validate config
			if (config.quickCaptureEnabled && !config.quickCaptureHotkey) {
				setHotkeyError("Please set a hotkey");
				return;
			}

			setHotkeyError(undefined);
			setHotkeyConfigState(config);

			try {
				await SetHotkeyConfig(globalHotkeyConfigToModel(config));
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				setHotkeyError(cleanedMessage);
				error(`Failed to update hotkey: ${cleanedMessage}`);
			}
		},
		[error],
	);

	const logLevelOptions: SelectOption[] = [
		{ value: "debug", label: "Debug" },
		{ value: "info", label: "Info" },
		{ value: "warn", label: "Warning" },
		{ value: "error", label: "Error" },
	];

	const commitIntervalOptions: SelectOption[] = [
		{ value: "5", label: "Every 5 minutes" },
		{ value: "10", label: "Every 10 minutes" },
		{ value: "15", label: "Every 15 minutes" },
		{ value: "30", label: "Every 30 minutes" },
		{ value: "60", label: "Every hour" },
		{ value: "0", label: "Manual only" },
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
		dataDirOverridden,
		dataDirEnvVar,
		gitSync,
		gitBranches,
		currentGitBranch,
		isReindexing,
		reindexProgress,
		showReindexConfirm,
		appScale,
		backupConfig,
		backups,
		hotkeyConfig,
		hotkeyError,
		platform,
		conflictInfo,
		showConflictDialog,
		logLevelOptions,
		commitIntervalOptions,
		handlers: {
			handleLogLevelChange,
			handleKeepInBackgroundToggle,
			handleStartHiddenToggle,
			handleLinuxWindowModeToggle,
			handleAppScaleChange,
			handleGitSyncToggle,
			handleCommitIntervalChange,
			handleAutoPushToggle,
			handleBranchChange,
			handlePickDirectory,
			handleMigration,
			handleSyncNow,
			handleRequestReindex,
			handleConfirmReindex,
			handleCancelReindex,
			handleBackupToggle,
			handleMaxBackupsChange,
			handleRestoreBackup,
			handleDeleteBackup,
			handleHotkeyConfigChange,
			handleConflictConfirm,
			handleConflictCancel,
		},
	};
};
