import { useCallback, useEffect, useState } from "react";
import type { BackupInfo } from "../../bindings/yanta/internal/backup/models";
import {
	Delete as DeleteBackup,
	GetConfig as GetBackupConfig,
	GetBackups,
	Restore as RestoreBackup,
	SetConfig as SetBackupConfig,
} from "../../bindings/yanta/internal/backup/service";
import type { BackupConfig } from "../../bindings/yanta/internal/config/models";
import { useNotification } from "../shared/hooks";
import { BackendLogger } from "../shared/utils/backendLogger";

export interface UseBackupSettingsOptions {
	onRestoreSuccess?: () => void;
}

export function useBackupSettings(options: UseBackupSettingsOptions = {}) {
	const { onRestoreSuccess } = options;
	const [backupConfig, setBackupConfig] = useState<BackupConfig>({
		Enabled: false,
		MaxBackups: 5,
	});
	const [backups, setBackups] = useState<BackupInfo[]>([]);
	const { success, error } = useNotification();

	useEffect(() => {
		GetBackupConfig()
			.then((config) => setBackupConfig(config))
			.catch((err) => BackendLogger.error("Failed to get backup config:", err));

		GetBackups()
			.then((backupList) => setBackups(backupList))
			.catch((err) => BackendLogger.error("Failed to get backups:", err));
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
				onRestoreSuccess?.();
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				error(`Restore failed:\n\n${cleanedMessage}`);
			}
		},
		[success, error, onRestoreSuccess],
	);

	const handleDeleteBackup = useCallback(
		async (backupPath: string) => {
			try {
				await DeleteBackup(backupPath);
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

	return {
		backupConfig,
		backups,
		handleBackupToggle,
		handleMaxBackupsChange,
		handleRestoreBackup,
		handleDeleteBackup,
	};
}
