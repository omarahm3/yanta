import { useCallback, useState } from "react";
import type { MigrationConflictInfo } from "../../bindings/yanta/internal/migration/models";
import { MigrationStrategy } from "../../bindings/yanta/internal/migration/models";
import {
	CheckMigrationConflicts,
	MigrateToGitDirectory,
	OpenDirectoryDialog,
	ValidateMigrationTarget,
} from "../../bindings/yanta/internal/system/service";
import { useNotification } from "../shared/hooks";

export function useMigrationSettings() {
	const [migrationTarget, setMigrationTarget] = useState("");
	const [isMigrating, setIsMigrating] = useState(false);
	const [migrationProgress, setMigrationProgress] = useState("");
	const [conflictInfo, setConflictInfo] = useState<MigrationConflictInfo | null>(null);
	const [showConflictDialog, setShowConflictDialog] = useState(false);
	const { success, error } = useNotification();

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

	const handlePickDirectory = useCallback(async () => {
		try {
			const selected = await OpenDirectoryDialog();
			if (selected) setMigrationTarget(selected);
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
			setMigrationProgress("Checking for conflicts...");
			const conflict = await CheckMigrationConflicts(migrationTarget);
			if (conflict?.hasConflict) {
				setConflictInfo(conflict);
				setShowConflictDialog(true);
				setIsMigrating(false);
				setMigrationProgress("");
				return;
			}
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

	return {
		migrationTarget,
		setMigrationTarget,
		isMigrating,
		migrationProgress,
		conflictInfo,
		showConflictDialog,
		handlePickDirectory,
		handleMigration,
		handleConflictConfirm,
		handleConflictCancel,
	};
}
