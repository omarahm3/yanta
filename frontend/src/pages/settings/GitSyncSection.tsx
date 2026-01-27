import { AlertTriangle, FolderOpen } from "lucide-react";
import React from "react";
import {
	Button,
	Input,
	Label,
	Select,
	type SelectOption,
	SettingsSection,
	Toggle,
} from "../../components/ui";

interface GitSyncSectionProps {
	gitInstalled: boolean;
	currentDataDir: string;
	migrationTarget: string;
	setMigrationTarget: (value: string) => void;
	isMigrating: boolean;
	migrationProgress: string;
	gitSyncEnabled: boolean;
	commitInterval: number;
	autoPush: boolean;
	commitIntervalOptions: SelectOption[];
	onGitSyncToggle: (enabled: boolean) => void;
	onCommitIntervalChange: (interval: number) => void;
	onAutoPushToggle: (enabled: boolean) => void;
	onPickDirectory: () => void;
	onMigration: () => void;
	onSyncNow: () => void;
}

export const GitSyncSection = React.forwardRef<HTMLDivElement, GitSyncSectionProps>(
	(
		{
			gitInstalled,
			currentDataDir,
			migrationTarget,
			setMigrationTarget,
			isMigrating,
			migrationProgress,
			gitSyncEnabled,
			commitInterval,
			autoPush,
			commitIntervalOptions,
			onGitSyncToggle,
			onCommitIntervalChange,
			onAutoPushToggle,
			onPickDirectory,
			onMigration,
			onSyncNow,
		},
		ref,
	) => {
		return (
			<div ref={ref}>
				<SettingsSection title="Git Sync" subtitle="Sync your data with a Git repository">
					<div className="space-y-4">
						{!gitInstalled && (
							<div className="p-4 border border-yellow-700 rounded bg-yellow-900/30">
								<div className="flex items-start gap-2">
									<AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
									<div>
										<div className="mb-1 font-medium text-yellow-400">Git Not Installed</div>
										<div className="text-sm text-yellow-300">
											Git is not found in your system PATH. Please install Git to enable sync functionality.
										</div>
									</div>
								</div>
							</div>
						)}

						<div className="space-y-2">
							<Label variant="uppercase">Current Data Directory</Label>
							<div className="text-sm font-mono text-text">{currentDataDir || "Loading..."}</div>
						</div>

						<div className="pt-4 space-y-3 border-t border-border">
							<Label variant="uppercase">Change Data Directory</Label>
							<div className="text-xs text-text-dim">
								Move your data to a different directory. YANTA will restart after migration.
							</div>
							<div className="space-y-2">
								<div className="flex gap-2">
									<Input
										variant="default"
										placeholder="/path/to/your/git/repo"
										value={migrationTarget}
										onChange={(e) => setMigrationTarget(e.target.value)}
										disabled={isMigrating || !gitInstalled}
										className="flex-1"
									/>
									<Button
										variant="ghost"
										size="sm"
										onClick={onPickDirectory}
										disabled={isMigrating || !gitInstalled}
										title="Browse for folder"
									>
										<FolderOpen className="w-4 h-4" />
									</Button>
								</div>
								<Button
									variant="primary"
									size="sm"
									onClick={onMigration}
									disabled={isMigrating || !gitInstalled || !migrationTarget}
									className="w-full"
								>
									{isMigrating ? "Migrating..." : "Migrate Data"}
								</Button>
							</div>
							{migrationProgress && <div className="text-xs text-text-dim">{migrationProgress}</div>}
						</div>

						<div className="flex items-center justify-between pt-4 border-t border-border">
							<div>
								<div className="text-sm text-text">Enable Git Sync</div>
								<div className="text-xs text-text-dim">Automatically sync changes to Git</div>
							</div>
							<Toggle checked={gitSyncEnabled} onChange={onGitSyncToggle} disabled={!gitInstalled} />
						</div>

						{gitSyncEnabled && (
							<>
								<div className="space-y-2">
									<Label variant="uppercase">Auto-commit Interval</Label>
									<Select
										value={commitInterval.toString()}
										onChange={(val) => onCommitIntervalChange(Number.parseInt(val, 10))}
										options={commitIntervalOptions}
									/>
									<div className="text-xs text-text-dim">
										Changes are batched and committed at this interval
									</div>
								</div>

								<div className="flex items-center justify-between pt-2">
									<div>
										<div className="text-sm text-text">Auto-push to remote</div>
										<div className="text-xs text-text-dim">
											Push commits to remote repository automatically
										</div>
									</div>
									<Toggle checked={autoPush} onChange={onAutoPushToggle} disabled={!gitInstalled} />
								</div>

								<div className="space-y-2">
									<Button variant="primary" size="sm" onClick={onSyncNow} disabled={!gitInstalled}>
										Sync Now
									</Button>
								</div>
							</>
						)}
					</div>
				</SettingsSection>
			</div>
		);
	},
);

GitSyncSection.displayName = "GitSyncSection";
