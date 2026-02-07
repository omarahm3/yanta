import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Check,
	Cloud,
	FolderOpen,
	RefreshCw,
} from "lucide-react";
import React from "react";
import {
	Button,
	Input,
	Label,
	Select,
	type SelectOption,
	SettingsSection,
	Toggle,
} from "../components/ui";
import type { GitStatus } from "../hooks/useGitStatus";

interface GitSyncSectionProps {
	gitInstalled: boolean;
	currentDataDir: string;
	migrationTarget: string;
	setMigrationTarget: (value: string) => void;
	isMigrating: boolean;
	migrationProgress: string;
	dataDirOverridden: boolean;
	dataDirEnvVar: string;
	gitSyncEnabled: boolean;
	commitInterval: number;
	autoPush: boolean;
	branch: string;
	branches: string[];
	currentBranch: string;
	commitIntervalOptions: SelectOption[];
	gitStatus?: GitStatus | null;
	gitStatusLoading?: boolean;
	onGitSyncToggle: (enabled: boolean) => void;
	onCommitIntervalChange: (interval: number) => void;
	onAutoPushToggle: (enabled: boolean) => void;
	onBranchChange: (branch: string) => void;
	onPickDirectory: () => void;
	onMigration: () => void;
	onSyncNow: () => void;
	onRefreshStatus?: () => void;
}

const GitStatusDisplay: React.FC<{
	status: GitStatus;
	isLoading: boolean;
	onRefresh?: () => void;
}> = ({ status, isLoading, onRefresh }) => {
	const hasConflicts = status.conflicted.length > 0;
	const hasChanges = !status.clean;
	const totalChanges =
		status.modified.length + status.untracked.length + status.deleted.length + status.staged.length;

	const getStatusColor = () => {
		if (hasConflicts) return "border-red bg-red/10";
		if (hasChanges) return "border-yellow bg-yellow/10";
		return "border-green bg-green/10";
	};

	const getStatusIcon = () => {
		if (isLoading) {
			return <RefreshCw className="w-4 h-4 animate-spin text-text-dim" />;
		}
		if (hasConflicts) {
			return <AlertTriangle className="w-4 h-4 text-red" />;
		}
		if (hasChanges) {
			return <Cloud className="w-4 h-4 text-yellow" />;
		}
		return <Check className="w-4 h-4 text-green" />;
	};

	const getStatusText = () => {
		if (hasConflicts) {
			return `${status.conflicted.length} conflict${status.conflicted.length > 1 ? "s" : ""} detected`;
		}
		if (hasChanges) {
			return `${totalChanges} uncommitted change${totalChanges > 1 ? "s" : ""}`;
		}
		return "Working directory clean";
	};

	return (
		<div className={`p-3 rounded border ${getStatusColor()}`}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{getStatusIcon()}
					<span className="text-sm font-medium text-text">{getStatusText()}</span>
				</div>
				{onRefresh && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRefresh}
						disabled={isLoading}
						className="p-1"
						title="Refresh status"
					>
						<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
				)}
			</div>

			{(status.ahead > 0 || status.behind > 0) && (
				<div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
					{status.ahead > 0 && (
						<span className="flex items-center gap-1 text-xs text-text-dim">
							<ArrowUp className="w-3 h-3" />
							<span>{status.ahead} ahead</span>
						</span>
					)}
					{status.behind > 0 && (
						<span className="flex items-center gap-1 text-xs text-text-dim">
							<ArrowDown className="w-3 h-3" />
							<span>{status.behind} behind</span>
						</span>
					)}
				</div>
			)}

			{hasConflicts && (
				<div className="mt-2 pt-2 border-t border-border/50">
					<div className="text-xs text-red">Conflicted files: {status.conflicted.join(", ")}</div>
				</div>
			)}

			{hasChanges && !hasConflicts && (
				<div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-dim">
					{status.modified.length > 0 && <span>Modified: {status.modified.length}</span>}
					{status.untracked.length > 0 && <span>Untracked: {status.untracked.length}</span>}
					{status.staged.length > 0 && <span>Staged: {status.staged.length}</span>}
					{status.deleted.length > 0 && <span>Deleted: {status.deleted.length}</span>}
					{status.renamed.length > 0 && <span>Renamed: {status.renamed.length}</span>}
				</div>
			)}
		</div>
	);
};

export const GitSyncSection = React.forwardRef<HTMLDivElement, GitSyncSectionProps>(
	(
		{
			gitInstalled,
			currentDataDir,
			migrationTarget,
			setMigrationTarget,
			isMigrating,
			migrationProgress,
			dataDirOverridden,
			dataDirEnvVar,
			gitSyncEnabled,
			commitInterval,
			autoPush,
			branch,
			branches,
			currentBranch,
			commitIntervalOptions,
			gitStatus,
			gitStatusLoading = false,
			onGitSyncToggle,
			onCommitIntervalChange,
			onAutoPushToggle,
			onBranchChange,
			onPickDirectory,
			onMigration,
			onSyncNow,
			onRefreshStatus,
		},
		ref,
	) => {
		const migrationDisabled = isMigrating || !gitInstalled || dataDirOverridden;
		// Use a sentinel value since Radix Select doesn't allow empty string values
		const CURRENT_BRANCH_VALUE = "__current__";
		const branchOptions: SelectOption[] = React.useMemo(() => {
			const options: SelectOption[] = [
				{
					value: CURRENT_BRANCH_VALUE,
					label: currentBranch ? `Current branch (${currentBranch})` : "Current branch",
				},
			];
			for (const b of branches) {
				options.push({ value: b, label: b });
			}
			return options;
		}, [branches, currentBranch]);

		// Convert between internal representation (empty string) and UI representation (sentinel)
		const selectedBranchValue = branch === "" ? CURRENT_BRANCH_VALUE : branch;
		const handleBranchSelect = (value: string) => {
			onBranchChange(value === CURRENT_BRANCH_VALUE ? "" : value);
		};
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

							{dataDirOverridden && (
								<div className="p-4 border border-blue-700 rounded bg-blue-900/30">
									<div className="flex items-start gap-2">
										<AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
										<div>
											<div className="mb-1 font-medium text-blue-400">Environment Override Active</div>
											<div className="text-sm text-blue-300">
												The <code className="px-1 py-0.5 bg-blue-800/50 rounded">YANTA_DATA_DIR</code>{" "}
												environment variable is set to:
											</div>
											<div className="mt-1 text-xs font-mono text-blue-200 break-all">{dataDirEnvVar}</div>
											<div className="mt-2 text-sm text-blue-300">
												Migration is disabled while this variable is set. Unset the environment variable and
												restart YANTA to change the data directory.
											</div>
										</div>
									</div>
								</div>
							)}

							<div className="space-y-2">
								<div className="flex gap-2">
									<Input
										variant="default"
										placeholder="/path/to/your/git/repo"
										value={migrationTarget}
										onChange={(e) => setMigrationTarget(e.target.value)}
										disabled={migrationDisabled}
										className="flex-1"
									/>
									<Button
										variant="ghost"
										size="sm"
										onClick={onPickDirectory}
										disabled={migrationDisabled}
										title="Browse for folder"
									>
										<FolderOpen className="w-4 h-4" />
									</Button>
								</div>
								<Button
									variant="primary"
									size="sm"
									onClick={onMigration}
									disabled={migrationDisabled || !migrationTarget}
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
								{gitStatus && (
									<div className="space-y-2">
										<Label variant="uppercase">Repository Status</Label>
										<GitStatusDisplay
											status={gitStatus}
											isLoading={gitStatusLoading}
											onRefresh={onRefreshStatus}
										/>
									</div>
								)}

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

								{branches.length > 0 && (
									<div className="space-y-2 pt-2">
										<Label variant="uppercase">Sync Branch</Label>
										<Select
											value={selectedBranchValue}
											onChange={handleBranchSelect}
											options={branchOptions}
										/>
										<div className="text-xs text-text-dim">
											Select a specific branch to sync, or use the current branch
										</div>
									</div>
								)}

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
