import { AlertTriangle } from "lucide-react";
import React from "react";
import { Button } from "../../shared/ui";

export interface ConflictBannerProps {
	onKeepMine?: () => void;
	onReloadFromDisk?: () => void;
	compact?: boolean;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = React.memo(
	({ onKeepMine, onReloadFromDisk, compact = false }) => {
		const padding = compact ? "px-4 py-2" : "px-6 py-3";
		const textSize = compact ? "text-xs" : "text-xs";

		return (
			<div
				className={`flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning/10 ${padding} ${textSize} text-warning`}
			>
				<AlertTriangle className="w-4 h-4 shrink-0" />
				<span className="font-semibold uppercase tracking-widest">External Change</span>
				<span className="text-text-dim normal-case">
					{compact ? "Modified outside the app." : "This document was modified outside the app."}
				</span>
				<div className="ml-auto flex gap-2">
					{onKeepMine && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onKeepMine}
							className="text-xs font-semibold uppercase tracking-widest"
						>
							Keep Mine
						</Button>
					)}
					{onReloadFromDisk && (
						<Button
							variant="primary"
							size="sm"
							onClick={onReloadFromDisk}
							className="text-xs font-semibold uppercase tracking-widest"
						>
							Reload
						</Button>
					)}
				</div>
			</div>
		);
	},
);

ConflictBanner.displayName = "ConflictBanner";
