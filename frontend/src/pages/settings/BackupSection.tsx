import { Clock, Database, Trash2 } from "lucide-react";
import React from "react";
import {
	Button,
	Input,
	Label,
	SettingsSection,
	Toggle,
} from "../../components/ui";

interface BackupInfo {
	timestamp: string;
	path: string;
	size: number;
}

interface BackupSectionProps {
	backupEnabled: boolean;
	maxBackups: number;
	backups: BackupInfo[];
	onBackupToggle: (enabled: boolean) => void;
	onMaxBackupsChange: (value: number) => void;
	onRestore: (backupPath: string) => void;
	onDelete: (backupPath: string) => void;
}

export const BackupSection = React.forwardRef<HTMLDivElement, BackupSectionProps>(
	(
		{
			backupEnabled,
			maxBackups,
			backups,
			onBackupToggle,
			onMaxBackupsChange,
			onRestore,
			onDelete,
		},
		ref,
	) => {
		const formatSize = (bytes: number): string => {
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
			return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		};

		const formatTimestamp = (timestamp: string): string => {
			try {
				const date = new Date(timestamp);
				return date.toLocaleString();
			} catch {
				return timestamp;
			}
		};

		return (
			<div ref={ref}>
				<SettingsSection title="Backup" subtitle="Automatic backups before Git sync operations">
					<div className="space-y-4">
						<div className="flex items-center justify-between pt-4 border-t border-border">
							<div>
								<div className="text-sm text-text">Enable Automatic Backups</div>
								<div className="text-xs text-text-dim">
									Create backup snapshots before each sync operation
								</div>
							</div>
							<Toggle checked={backupEnabled} onChange={onBackupToggle} />
						</div>

						{backupEnabled && (
							<>
								<div className="space-y-2">
									<Label variant="uppercase">Maximum Backups to Keep</Label>
									<Input
										variant="default"
										type="number"
										min={1}
										max={50}
										value={maxBackups.toString()}
										onChange={(e) => {
											const value = Number.parseInt(e.target.value, 10);
											if (!Number.isNaN(value) && value >= 1 && value <= 50) {
												onMaxBackupsChange(value);
											}
										}}
										className="w-32"
									/>
									<div className="text-xs text-text-dim">
										Older backups are automatically deleted when this limit is reached
									</div>
								</div>

								<div className="pt-4 space-y-3 border-t border-border">
									<Label variant="uppercase">Available Backups</Label>
									{backups.length === 0 ? (
										<div className="p-4 text-sm border rounded border-border text-text-dim">
											No backups available yet. Backups are created automatically before sync operations.
										</div>
									) : (
										<div className="space-y-2">
											{backups.map((backup) => (
												<div
													key={backup.path}
													className="flex items-center justify-between p-3 border rounded border-border hover:bg-bg-hover"
												>
													<div className="flex items-start gap-3 flex-1">
														<Database className="w-4 h-4 mt-0.5 text-text-dim shrink-0" />
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-1">
																<Clock className="w-3 h-3 text-text-dim" />
																<div className="text-sm text-text">
																	{formatTimestamp(backup.timestamp)}
																</div>
															</div>
															<div className="text-xs text-text-dim">
																{formatSize(backup.size)}
															</div>
														</div>
													</div>
													<div className="flex gap-2 shrink-0">
														<Button
															variant="primary"
															size="sm"
															onClick={() => onRestore(backup.path)}
														>
															Restore
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => onDelete(backup.path)}
															title="Delete backup"
														>
															<Trash2 className="w-4 h-4" />
														</Button>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</>
						)}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

BackupSection.displayName = "BackupSection";
