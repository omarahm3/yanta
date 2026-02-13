import { AlertTriangle, Database, FileText, FolderOpen, HardDrive } from "lucide-react";
import React, { useState } from "react";
import type {
	MigrationConflictInfo,
	VaultStats,
} from "../../../bindings/yanta/internal/migration/models";
import { MigrationStrategy } from "../../../bindings/yanta/internal/migration/models";
import { Button } from "./Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Label } from "./Label";

interface MigrationConflictDialogProps {
	isOpen: boolean;
	conflictInfo: MigrationConflictInfo | null;
	onCancel: () => void;
	onConfirm: (strategy: MigrationStrategy) => void;
	isLoading?: boolean;
}

interface VaultStatsCardProps {
	title: string;
	path: string;
	stats: VaultStats | null | undefined;
	variant: "local" | "target";
}

const VaultStatsCard: React.FC<VaultStatsCardProps> = ({ title, path, stats, variant }) => {
	const borderColor = variant === "local" ? "border-blue-500/50" : "border-green-500/50";
	const bgColor = variant === "local" ? "bg-blue-500/10" : "bg-green-500/10";
	const iconColor = variant === "local" ? "text-blue-400" : "text-green-400";

	return (
		<div className={`flex-1 p-3 rounded-lg border backdrop-blur-sm ${borderColor} ${bgColor}`}>
			<div className="flex items-center gap-2 mb-2">
				<HardDrive className={`w-4 h-4 ${iconColor}`} />
				<span className="text-sm font-medium text-text">{title}</span>
			</div>
			<div className="text-xs font-mono text-text-dim mb-3 break-all">{path}</div>
			{stats ? (
				<div className="space-y-1.5">
					<div className="flex items-center gap-2 text-xs text-text-dim">
						<FolderOpen className="w-3.5 h-3.5" />
						<span>
							{stats.projectCount} project{stats.projectCount !== 1 ? "s" : ""}
						</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-text-dim">
						<FileText className="w-3.5 h-3.5" />
						<span>
							{stats.documentCount} document{stats.documentCount !== 1 ? "s" : ""}
						</span>
					</div>
					<div className="flex items-center gap-2 text-xs text-text-dim">
						<Database className="w-3.5 h-3.5" />
						<span>{stats.totalSizeHuman}</span>
					</div>
				</div>
			) : (
				<div className="text-xs text-text-dim italic">No data available</div>
			)}
		</div>
	);
};

interface StrategyOptionProps {
	strategy: MigrationStrategy;
	selected: boolean;
	onSelect: (strategy: MigrationStrategy) => void;
	title: string;
	description: string;
	warning?: string;
}

const StrategyOption: React.FC<StrategyOptionProps> = ({
	strategy,
	selected,
	onSelect,
	title,
	description,
	warning,
}) => {
	return (
		<button
			type="button"
			onClick={() => onSelect(strategy)}
			className={`w-full text-left p-3 rounded-lg border transition-colors ${
				selected
					? "border-accent bg-accent/10 backdrop-blur-sm"
					: "border-glass-border hover:border-accent/30 hover:bg-glass-bg/20"
			}`}
		>
			<div className="flex items-start gap-3">
				<div
					className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
						selected ? "border-accent" : "border-text-dim"
					}`}
				>
					{selected && <div className="w-2 h-2 rounded-full bg-accent" />}
				</div>
				<div className="flex-1">
					<div className="text-sm font-medium text-text">{title}</div>
					<div className="text-xs text-text-dim mt-0.5">{description}</div>
					{warning && (
						<div className="flex items-center gap-1.5 mt-2 text-xs text-yellow">
							<AlertTriangle className="w-3 h-3" />
							<span>{warning}</span>
						</div>
					)}
				</div>
			</div>
		</button>
	);
};

export const MigrationConflictDialog: React.FC<MigrationConflictDialogProps> = ({
	isOpen,
	conflictInfo,
	onCancel,
	onConfirm,
	isLoading = false,
}) => {
	const [selectedStrategy, setSelectedStrategy] = useState<MigrationStrategy>(
		MigrationStrategy.StrategyUseRemote,
	);

	const handleConfirm = () => {
		onConfirm(selectedStrategy);
	};

	// Reset selection when dialog opens
	React.useEffect(() => {
		if (isOpen) {
			setSelectedStrategy(MigrationStrategy.StrategyUseRemote);
		}
	}, [isOpen]);

	if (!conflictInfo) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent className="sm:max-w-xl" showCloseButton={!isLoading}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="w-5 h-5 text-yellow" />
						Vault Conflict Detected
					</DialogTitle>
					<DialogDescription>
						Both locations contain YANTA vault data. Choose how to resolve this conflict.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Vault comparison */}
					<div>
						<Label variant="uppercase" className="mb-2 block">
							Vault Comparison
						</Label>
						<div className="flex gap-3">
							<VaultStatsCard
								title="Local Vault"
								path={conflictInfo.localPath}
								stats={conflictInfo.localVault}
								variant="local"
							/>
							<VaultStatsCard
								title="Target Vault"
								path={conflictInfo.targetPath}
								stats={conflictInfo.targetVault}
								variant="target"
							/>
						</div>
					</div>

					{/* Strategy selection */}
					<div>
						<Label variant="uppercase" className="mb-2 block">
							Resolution Strategy
						</Label>
						<div className="space-y-2">
							<StrategyOption
								strategy={MigrationStrategy.StrategyUseRemote}
								selected={selectedStrategy === MigrationStrategy.StrategyUseRemote}
								onSelect={setSelectedStrategy}
								title="Use Target (Recommended)"
								description="Keep the target vault data and discard your local data. Best when syncing to an existing shared repository."
								warning="Your local vault data will be discarded"
							/>
							<StrategyOption
								strategy={MigrationStrategy.StrategyUseLocal}
								selected={selectedStrategy === MigrationStrategy.StrategyUseLocal}
								onSelect={setSelectedStrategy}
								title="Use Local"
								description="Replace the target vault with your local data. A backup of the target will be created first."
								warning="Target vault data will be overwritten"
							/>
							<StrategyOption
								strategy={MigrationStrategy.StrategyMergeBoth}
								selected={selectedStrategy === MigrationStrategy.StrategyMergeBoth}
								onSelect={setSelectedStrategy}
								title="Merge Both"
								description="Copy local files that don't exist in target. Existing target files are preserved."
							/>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onCancel} disabled={isLoading}>
						Cancel
					</Button>
					<Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
						{isLoading ? "Migrating..." : "Proceed with Migration"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
