import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Check,
	ChevronRight,
	CloudUpload,
	Copy,
	FolderOpen,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";
import React from "react";
import type { GitStatus } from "../shared/hooks";
import {
	Button,
	Callout,
	ConfirmDialog,
	Input,
	Label,
	Select,
	type SelectOption,
	SettingsSection,
	Toggle,
} from "../shared/ui";

interface LastSync {
	at: number;
	status: string;
}

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
	gitStatusError?: string | null;
	lastSync?: LastSync | null;
	settingsLoadError?: string | null;
	onRetryLoadSettings?: () => void;
	onGitSyncToggle: (enabled: boolean) => void;
	onCommitIntervalChange: (interval: number) => void;
	onAutoPushToggle: (enabled: boolean) => void;
	onBranchChange: (branch: string) => void;
	onPickDirectory: () => void;
	onMigration: () => void;
	onSyncNow: () => void;
	syncNowInFlight?: boolean;
	onRefreshStatus?: () => void;
}

type HealthTone = "green" | "yellow" | "red" | "neutral";

const toneStyles: Record<HealthTone, { box: string; icon: string }> = {
	green: { box: "border-green/40 bg-green/10", icon: "text-green" },
	yellow: { box: "border-yellow/40 bg-yellow/10", icon: "text-yellow" },
	red: { box: "border-red/40 bg-red/10", icon: "text-red" },
	neutral: { box: "border-border", icon: "text-text-dim" },
};

interface Health {
	tone: HealthTone;
	Icon: React.ComponentType<{ className?: string }>;
	title: string;
	detail?: string;
}

function relativeTime(ms: number): string {
	const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
	if (secs < 10) return "just now";
	if (secs < 60) return `${secs}s ago`;
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

// deriveHealth turns raw git status + the last sync outcome into one honest,
// plain-language line. "Backed up" is only claimed after a confirmed remote
// sync — a clean tree alone doesn't mean anything reached the remote.
function deriveHealth(
	status: GitStatus | null | undefined,
	lastSync: LastSync | null | undefined,
	autoPush: boolean,
): Health {
	if (!status) {
		return { tone: "neutral", Icon: RefreshCw, title: "Checking status…" };
	}

	if (status.conflicted.length > 0 || lastSync?.status === "conflict") {
		return {
			tone: "red",
			Icon: AlertTriangle,
			title: "Merge conflict needs resolving",
			detail: "Your notes are safe. Auto-sync is paused until you resolve it.",
		};
	}

	if (lastSync?.status === "error" || lastSync?.status === "push_failed") {
		return {
			tone: "yellow",
			Icon: AlertTriangle,
			title: "Last sync didn't finish",
			detail: "Your notes are saved locally. Check your connection or credentials, then Sync now.",
		};
	}

	const pending =
		status.modified.length + status.untracked.length + status.deleted.length + status.staged.length;
	if (pending > 0) {
		return {
			tone: "yellow",
			Icon: CloudUpload,
			title: `${pending} change${pending > 1 ? "s" : ""} waiting to sync`,
		};
	}

	if (status.ahead > 0) {
		return {
			tone: "yellow",
			Icon: ArrowUp,
			title: `${status.ahead} commit${status.ahead > 1 ? "s" : ""} not yet pushed`,
		};
	}

	const syncedOk =
		lastSync?.status === "synced" ||
		lastSync?.status === "up_to_date" ||
		lastSync?.status === "no_changes";
	if (autoPush && syncedOk) {
		return { tone: "green", Icon: ShieldCheck, title: "All notes backed up" };
	}
	if (autoPush) {
		return {
			tone: "green",
			Icon: Check,
			title: "All changes committed",
			detail: "They'll back up to the remote on the next sync.",
		};
	}
	return {
		tone: "green",
		Icon: Check,
		title: "All changes committed locally",
		detail: "Auto-push is off, so nothing is sent to a remote.",
	};
}

const ConflictRecovery: React.FC<{ files: string[]; dataDir: string }> = ({ files, dataDir }) => {
	const [copied, setCopied] = React.useState<null | "cmds" | "path">(null);
	const copy = async (what: "cmds" | "path", text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(what);
			setTimeout(() => setCopied(null), 2000);
		} catch {
			// clipboard unavailable — the commands/path are shown below regardless
		}
	};

	// After the backend hardening a failed sync leaves a CLEAN tree (the
	// rebase/merge is aborted), so usually there are no marker files and the fix
	// is to reconcile with the remote. Only an externally-created conflict
	// leaves markers on disk.
	const hasMarkers = files.length > 0;
	const commands = hasMarkers
		? `cd "${dataDir}"\ngit status                 # list the conflicts\n# remove the <<<<<<< markers in the files above, then:\ngit add -A && git commit`
		: `cd "${dataDir}"\ngit pull --rebase          # reconcile with the remote\n# fix any conflicts it reports, then:\ngit rebase --continue`;

	return (
		<Callout
			variant="danger"
			icon={<AlertTriangle className="h-5 w-5" />}
			title={
				hasMarkers
					? `Conflict in ${files.length} file${files.length > 1 ? "s" : ""}`
					: "Remote has conflicting changes"
			}
		>
			<div className="space-y-3">
				<div className="text-xs text-text-dim">
					Your local notes are safe and committed.{" "}
					{hasMarkers
						? "Resolve the conflicts, then Sync now."
						: "Reconcile with the remote, then Sync now."}
				</div>
				{hasMarkers && (
					<ul className="space-y-0.5 font-mono text-xs text-text">
						{files.map((f) => (
							<li key={f} className="truncate">
								{f}
							</li>
						))}
					</ul>
				)}
				<pre className="overflow-x-auto rounded bg-accent/10 p-2 font-mono text-[11px] leading-5 text-text">
					{commands}
				</pre>
				<div className="flex flex-wrap gap-2">
					<Button variant="secondary" size="sm" onClick={() => copy("cmds", commands)}>
						<span className="flex items-center gap-1.5">
							{copied === "cmds" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							{copied === "cmds" ? "Copied" : "Copy commands"}
						</span>
					</Button>
					<Button variant="ghost" size="sm" onClick={() => copy("path", dataDir)}>
						<span className="flex items-center gap-1.5">
							{copied === "path" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							{copied === "path" ? "Copied" : "Copy path"}
						</span>
					</Button>
				</div>
			</div>
		</Callout>
	);
};

// RepoSetup handles the "Git Sync is on, but the data directory isn't a Git
// repository" state — previously this only showed up in the logs as a raw
// error while the panel sat on "Checking status…" forever.
const RepoSetup: React.FC<{ dataDir: string }> = ({ dataDir }) => {
	const [copied, setCopied] = React.useState(false);
	const commands = `cd "${dataDir}"\ngit init\ngit add -A && git commit -m "Initial commit"\n# optional — back up off-device:\ngit remote add origin <your-repo-url>`;
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(commands);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard unavailable — the commands are shown below regardless
		}
	};
	return (
		<Callout
			variant="warning"
			icon={<AlertTriangle className="h-5 w-5" />}
			title="Not a Git repository yet"
		>
			<div className="space-y-3">
				<div className="text-xs text-text-dim">
					Git Sync is on, but your notes folder isn't a Git repository — so nothing can be committed or
					backed up. Initialize it, or use{" "}
					<span className="text-text">Data directory &amp; migration</span> below to move your notes into
					an existing repo.
				</div>
				<pre className="overflow-x-auto rounded bg-accent/10 p-2 font-mono text-[11px] leading-5 text-text">
					{commands}
				</pre>
				<Button variant="secondary" size="sm" onClick={copy}>
					<span className="flex items-center gap-1.5">
						{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
						{copied ? "Copied" : "Copy setup commands"}
					</span>
				</Button>
			</div>
		</Callout>
	);
};

const SyncHealth: React.FC<{
	status?: GitStatus | null;
	isLoading: boolean;
	error?: string | null;
	lastSync?: LastSync | null;
	autoPush: boolean;
	currentDataDir: string;
	syncNowInFlight: boolean;
	onSyncNow: () => void;
	onRefresh?: () => void;
}> = ({
	status,
	isLoading,
	error,
	lastSync,
	autoPush,
	currentDataDir,
	syncNowInFlight,
	onSyncNow,
	onRefresh,
}) => {
	// Re-render on an interval so "synced N min ago" stays current between polls.
	const [, tick] = React.useState(0);
	React.useEffect(() => {
		const id = setInterval(() => tick((n) => n + 1), 30_000);
		return () => clearInterval(id);
	}, []);

	const health = deriveHealth(status, lastSync, autoPush);
	const tone = toneStyles[health.tone];
	const notARepo = status?.isRepo === false;
	const fetchError = !status && !isLoading && !!error;
	const hasConflicts = (status?.conflicted.length ?? 0) > 0;
	const showConflict = !notARepo && (hasConflicts || lastSync?.status === "conflict");
	const behind = status?.behind ?? 0;
	const showSyncedAgo = lastSync && health.tone === "green";

	const healthBox = (
		<div className={`rounded-lg border p-4 ${tone.box}`}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<health.Icon
						className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon} ${isLoading && health.tone === "neutral" ? "animate-spin" : ""}`}
					/>
					<div className="min-w-0">
						<div className="text-sm font-medium text-text">{health.title}</div>
						{health.detail && <div className="mt-0.5 text-xs text-text-dim">{health.detail}</div>}
						{(showSyncedAgo || behind > 0) && (
							<div className="mt-1 flex items-center gap-3 text-xs text-text-dim">
								{showSyncedAgo && lastSync && <span>Synced {relativeTime(lastSync.at)}</span>}
								{behind > 0 && (
									<span className="flex items-center gap-1">
										<ArrowDown className="h-3 w-3" />
										{behind} incoming
									</span>
								)}
							</div>
						)}
					</div>
				</div>
				{onRefresh && (
					<Button
						variant="ghost"
						size="sm"
						onClick={onRefresh}
						disabled={isLoading}
						className="p-1.5"
						aria-label="Refresh sync status"
						title="Refresh sync status"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
					</Button>
				)}
			</div>
		</div>
	);

	return (
		<div className="space-y-3">
			{notARepo ? (
				<RepoSetup dataDir={currentDataDir} />
			) : fetchError ? (
				<Callout
					variant="danger"
					icon={<AlertTriangle className="h-5 w-5" />}
					title="Couldn't read sync status"
				>
					<div className="break-words text-xs text-text-dim">{error}</div>
				</Callout>
			) : (
				healthBox
			)}

			{showConflict && <ConflictRecovery files={status?.conflicted ?? []} dataDir={currentDataDir} />}

			{!notARepo && (
				<Button variant="primary" size="sm" onClick={onSyncNow} disabled={syncNowInFlight}>
					{syncNowInFlight ? "Syncing…" : "Sync now"}
				</Button>
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
			gitStatusError,
			lastSync,
			settingsLoadError,
			onRetryLoadSettings,
			onGitSyncToggle,
			onCommitIntervalChange,
			onAutoPushToggle,
			onBranchChange,
			onPickDirectory,
			onMigration,
			onSyncNow,
			syncNowInFlight = false,
			onRefreshStatus,
		},
		ref,
	) => {
		const migrationDisabled = isMigrating || !gitInstalled || dataDirOverridden;
		const [confirmMigrate, setConfirmMigrate] = React.useState(false);

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

		const selectedBranchValue = branch === "" ? CURRENT_BRANCH_VALUE : branch;
		const handleBranchSelect = (value: string) => {
			onBranchChange(value === CURRENT_BRANCH_VALUE ? "" : value);
		};

		return (
			<div ref={ref}>
				<SettingsSection id="sync" title="Git Sync" subtitle="Back up your notes to a Git repository">
					<div className="space-y-4">
						{!gitInstalled && (
							<Callout
								variant="warning"
								icon={<AlertTriangle className="h-5 w-5" />}
								title="Git not installed"
							>
								Git isn't in your system PATH. Install Git to enable sync.
							</Callout>
						)}

						{settingsLoadError && (
							<Callout
								variant="danger"
								icon={<AlertTriangle className="h-5 w-5" />}
								title="Couldn't load settings"
							>
								<div className="flex items-center gap-3">
									<span className="text-xs text-text-dim">{settingsLoadError}</span>
									{onRetryLoadSettings && (
										<Button variant="secondary" size="sm" onClick={onRetryLoadSettings}>
											Retry
										</Button>
									)}
								</div>
							</Callout>
						)}

						{/* Primary: enable + status + sync now */}
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm text-text">Enable Git Sync</div>
								<div className="text-xs text-text-dim">Automatically commit and back up your notes</div>
							</div>
							<Toggle checked={gitSyncEnabled} onChange={onGitSyncToggle} disabled={!gitInstalled} />
						</div>

						{gitSyncEnabled && (
							<>
								<SyncHealth
									status={gitStatus}
									isLoading={gitStatusLoading}
									error={gitStatusError}
									lastSync={lastSync}
									autoPush={autoPush}
									currentDataDir={currentDataDir}
									syncNowInFlight={syncNowInFlight}
									onSyncNow={onSyncNow}
									onRefresh={onRefreshStatus}
								/>

								<div className="space-y-4 border-t border-border pt-4">
									<div className="space-y-2">
										<Label variant="uppercase">Auto-commit interval</Label>
										<Select
											value={commitInterval.toString()}
											onChange={(val) => onCommitIntervalChange(Number.parseInt(val, 10))}
											options={commitIntervalOptions}
										/>
										<div className="text-xs text-text-dim">
											Changes are batched and committed at this interval
										</div>
									</div>

									<div className="flex items-center justify-between">
										<div>
											<div className="text-sm text-text">Auto-push to remote</div>
											<div className="text-xs text-text-dim">
												Requires a Git remote (origin) in your data directory
											</div>
										</div>
										<Toggle checked={autoPush} onChange={onAutoPushToggle} disabled={!gitInstalled} />
									</div>

									<div className="space-y-2">
										<Label variant="uppercase">Sync branch</Label>
										{branches.length > 0 ? (
											<Select
												value={selectedBranchValue}
												onChange={handleBranchSelect}
												options={branchOptions}
											/>
										) : (
											<div className="text-xs text-text-dim">
												Syncing the current branch
												{currentBranch ? ` (${currentBranch})` : ""}. Other branches appear here once the
												repository has them.
											</div>
										)}
									</div>
								</div>
							</>
						)}

						{/* Secondary: data directory + migration, tucked away */}
						<details className="group border-t border-border pt-4">
							<summary className="flex cursor-pointer list-none items-center justify-between text-sm text-text-dim transition-colors hover:text-text">
								<span>Data directory &amp; migration</span>
								<ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
							</summary>

							<div className="mt-4 space-y-4">
								<div className="space-y-1">
									<Label variant="uppercase">Current data directory</Label>
									<div className="break-all font-mono text-sm text-text">{currentDataDir || "Loading…"}</div>
								</div>

								{dataDirOverridden && (
									<Callout
										variant="info"
										icon={<AlertTriangle className="h-5 w-5" />}
										title="Environment override active"
									>
										<code className="rounded bg-accent/20 px-1 py-0.5 text-accent">YANTA_HOME</code> is set
										to:
										<div className="mt-1 break-all font-mono text-xs text-text">{dataDirEnvVar}</div>
										<div className="mt-2">
											Migration is disabled while this is set. Unset it and restart YANTA to change the data
											directory.
										</div>
									</Callout>
								)}

								<div className="space-y-2">
									<Label variant="uppercase">Move data to a new directory</Label>
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
											aria-label="Browse for folder"
											title="Browse for folder"
										>
											<FolderOpen className="h-4 w-4" />
										</Button>
									</div>
									<Button
										variant="secondary"
										size="sm"
										onClick={() => setConfirmMigrate(true)}
										disabled={migrationDisabled || !migrationTarget}
										className="w-full"
									>
										{isMigrating ? "Migrating…" : "Move & restart"}
									</Button>
									{migrationProgress && <div className="text-xs text-text-dim">{migrationProgress}</div>}
								</div>
							</div>
						</details>
					</div>
				</SettingsSection>

				<ConfirmDialog
					isOpen={confirmMigrate}
					title="Move your data and restart?"
					message={`YANTA will copy all your notes to "${migrationTarget}" and restart. Your current data is copied, not deleted.`}
					confirmText="Move & restart"
					cancelText="Cancel"
					onConfirm={() => {
						setConfirmMigrate(false);
						onMigration();
					}}
					onCancel={() => setConfirmMigrate(false)}
				/>
			</div>
		);
	},
);

GitSyncSection.displayName = "GitSyncSection";
