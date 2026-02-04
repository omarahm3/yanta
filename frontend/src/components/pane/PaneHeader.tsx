import { Columns, Rows, X } from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { usePaneLayout } from "../../hooks/usePaneLayout";
import { cn } from "../../lib/utils";
import { MAX_PANES } from "../../types/PaneLayout";
import { countLeaves } from "../../utils/paneLayoutUtils";

export interface PaneHeaderProps {
	paneId: string;
	documentPath: string | null;
	className?: string;
}

/**
 * PaneHeader displays a compact title bar for each pane with:
 * - Document title (derived from path) or "Empty"
 * - Split horizontal button (Columns icon)
 * - Split vertical button (Rows icon)
 * - Close pane button (X icon, only when multiple panes exist)
 */
export const PaneHeader: React.FC<PaneHeaderProps> = ({ paneId, documentPath, className }) => {
	const { layout, activePaneId, splitPane, closePane } = usePaneLayout();

	const isActive = activePaneId === paneId;
	const leafCount = useMemo(() => countLeaves(layout.root), [layout.root]);
	const canSplit = leafCount < MAX_PANES;
	const canClose = leafCount > 1;

	const title = useMemo(() => {
		if (!documentPath) return "Empty";
		// Extract filename without extension from path
		const segments = documentPath.split("/");
		const fileName = segments[segments.length - 1] ?? documentPath;
		return fileName.replace(/\.md$/, "");
	}, [documentPath]);

	const handleSplitHorizontal = useCallback(() => {
		splitPane(paneId, "horizontal");
	}, [paneId, splitPane]);

	const handleSplitVertical = useCallback(() => {
		splitPane(paneId, "vertical");
	}, [paneId, splitPane]);

	const handleClose = useCallback(() => {
		closePane(paneId);
	}, [paneId, closePane]);

	return (
		<div
			className={cn(
				"bg-surface border-b border-border px-3 flex items-center justify-between h-8 shrink-0",
				isActive && "border-t-2 border-t-accent",
				!isActive && "border-t-2 border-t-transparent",
				className,
			)}
		>
			{/* Title */}
			<span
				className={cn(
					"text-xs truncate mr-2",
					documentPath ? "text-text-bright font-medium" : "text-text-dim",
				)}
				title={documentPath ?? undefined}
			>
				{title}
			</span>

			{/* Actions */}
			<div className="flex items-center gap-0.5 shrink-0">
				<button
					type="button"
					className={cn(
						"flex items-center justify-center w-6 h-6 rounded transition-colors",
						canSplit
							? "text-text-dim hover:text-text-bright hover:bg-bg"
							: "text-text-dim/30 cursor-not-allowed",
					)}
					onClick={handleSplitHorizontal}
					disabled={!canSplit}
					title="Split horizontally"
					aria-label="Split horizontally"
				>
					<Columns className="w-3.5 h-3.5" />
				</button>

				<button
					type="button"
					className={cn(
						"flex items-center justify-center w-6 h-6 rounded transition-colors",
						canSplit
							? "text-text-dim hover:text-text-bright hover:bg-bg"
							: "text-text-dim/30 cursor-not-allowed",
					)}
					onClick={handleSplitVertical}
					disabled={!canSplit}
					title="Split vertically"
					aria-label="Split vertically"
				>
					<Rows className="w-3.5 h-3.5" />
				</button>

				{canClose && (
					<button
						type="button"
						className="flex items-center justify-center w-6 h-6 rounded text-text-dim hover:text-text-bright hover:bg-bg transition-colors"
						onClick={handleClose}
						title="Close pane"
						aria-label="Close pane"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
		</div>
	);
};
