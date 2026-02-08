import { useState } from "react";
import { useAppearanceSettings } from "./useAppearanceSettings";
import { useBackupSettings } from "./useBackupSettings";
import { useGitSyncSettings } from "./useGitSyncSettings";
import { useMigrationSettings } from "./useMigrationSettings";
import { useSystemSettings } from "./useSystemSettings";

export const useSettingsController = () => {
	const [needsRestart, setNeedsRestart] = useState(false);

	const {
		backupConfig,
		backups,
		handleBackupToggle,
		handleMaxBackupsChange,
		handleRestoreBackup,
		handleDeleteBackup,
	} = useBackupSettings({ onRestoreSuccess: () => setNeedsRestart(true) });

	const system = useSystemSettings({ setNeedsRestart });

	const { appScale, logLevelOptions, handleAppScaleChange, handleLogLevelChange } =
		useAppearanceSettings({
			setNeedsRestart,
			refreshSystemInfo: system.refreshSystemInfo,
		});

	const gitSyncSettings = useGitSyncSettings();
	const migration = useMigrationSettings();

	return {
		...system,
		needsRestart,
		...gitSyncSettings,
		...migration,
		appScale,
		backupConfig,
		backups,
		logLevelOptions,
		handlers: {
			handleLogLevelChange,
			handleKeepInBackgroundToggle: system.handleKeepInBackgroundToggle,
			handleStartHiddenToggle: system.handleStartHiddenToggle,
			handleLinuxWindowModeToggle: system.handleLinuxWindowModeToggle,
			handleAppScaleChange,
			handleGitSyncToggle: gitSyncSettings.handleGitSyncToggle,
			handleCommitIntervalChange: gitSyncSettings.handleCommitIntervalChange,
			handleAutoPushToggle: gitSyncSettings.handleAutoPushToggle,
			handleBranchChange: gitSyncSettings.handleBranchChange,
			handlePickDirectory: migration.handlePickDirectory,
			handleMigration: migration.handleMigration,
			handleSyncNow: gitSyncSettings.handleSyncNow,
			handleRequestReindex: system.handleRequestReindex,
			handleConfirmReindex: system.handleConfirmReindex,
			handleCancelReindex: system.handleCancelReindex,
			handleBackupToggle,
			handleMaxBackupsChange,
			handleRestoreBackup,
			handleDeleteBackup,
			handleHotkeyConfigChange: system.handleHotkeyConfigChange,
			handleConflictConfirm: migration.handleConflictConfirm,
			handleConflictCancel: migration.handleConflictCancel,
		},
	};
};
