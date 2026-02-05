import { AlertTriangle, ArrowDown, ArrowUp, Check, Cloud, CloudOff, RefreshCw } from "lucide-react";
import type React from "react";
import type { GitStatus } from "../../hooks/useGitStatus";

interface GitStatusIndicatorProps {
	status: GitStatus | null;
	isLoading?: boolean;
	compact?: boolean;
	onClick?: () => void;
}

export const GitStatusIndicator: React.FC<GitStatusIndicatorProps> = ({
	status,
	isLoading = false,
	compact = false,
	onClick,
}) => {
	if (!status?.enabled) {
		return null;
	}

	const hasConflicts = status.conflicted.length > 0;
	const hasChanges = !status.clean;
	const isAhead = status.ahead > 0;
	const isBehind = status.behind > 0;

	const getStatusColor = () => {
		if (hasConflicts) return "text-red";
		if (hasChanges) return "text-yellow";
		return "text-green";
	};

	const getStatusIcon = () => {
		if (isLoading) {
			return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
		}
		if (hasConflicts) {
			return <AlertTriangle className="w-3.5 h-3.5" />;
		}
		if (hasChanges) {
			return <Cloud className="w-3.5 h-3.5" />;
		}
		return <Check className="w-3.5 h-3.5" />;
	};

	const getStatusText = () => {
		if (hasConflicts) {
			return `${status.conflicted.length} conflict${status.conflicted.length > 1 ? "s" : ""}`;
		}
		if (hasChanges) {
			const total =
				status.modified.length + status.untracked.length + status.deleted.length + status.staged.length;
			return `${total} change${total > 1 ? "s" : ""}`;
		}
		return "Clean";
	};

	const getTooltip = () => {
		const parts: string[] = [];

		if (hasConflicts) {
			parts.push(`Conflicts: ${status.conflicted.join(", ")}`);
		}
		if (status.modified.length > 0) {
			parts.push(`Modified: ${status.modified.length}`);
		}
		if (status.untracked.length > 0) {
			parts.push(`Untracked: ${status.untracked.length}`);
		}
		if (status.deleted.length > 0) {
			parts.push(`Deleted: ${status.deleted.length}`);
		}
		if (status.staged.length > 0) {
			parts.push(`Staged: ${status.staged.length}`);
		}
		if (status.renamed.length > 0) {
			parts.push(`Renamed: ${status.renamed.length}`);
		}
		if (isAhead || isBehind) {
			parts.push(`${status.ahead} ahead, ${status.behind} behind`);
		}

		return parts.length > 0 ? parts.join(" | ") : "Repository is clean";
	};

	if (compact) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${getStatusColor()} hover:bg-glass-bg/30 transition-colors`}
				title={getTooltip()}
			>
				{getStatusIcon()}
				{(isAhead || isBehind) && (
					<span className="flex items-center gap-0.5 text-text-dim">
						{isAhead && (
							<span className="flex items-center">
								<ArrowUp className="w-3 h-3" />
								{status.ahead}
							</span>
						)}
						{isBehind && (
							<span className="flex items-center">
								<ArrowDown className="w-3 h-3" />
								{status.behind}
							</span>
						)}
					</span>
				)}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${getStatusColor()} hover:bg-glass-bg/30 transition-colors`}
			title={getTooltip()}
		>
			{getStatusIcon()}
			<span>{getStatusText()}</span>
			{(isAhead || isBehind) && (
				<span className="flex items-center gap-1 text-text-dim border-l border-glass-border pl-2 ml-1">
					{isAhead && (
						<span className="flex items-center gap-0.5">
							<ArrowUp className="w-3 h-3" />
							{status.ahead}
						</span>
					)}
					{isBehind && (
						<span className="flex items-center gap-0.5">
							<ArrowDown className="w-3 h-3" />
							{status.behind}
						</span>
					)}
				</span>
			)}
		</button>
	);
};
