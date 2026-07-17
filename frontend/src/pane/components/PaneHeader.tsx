import { Columns, FileText, PenTool, Rows, X } from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useDensity } from "../../shared/stores/density.store";
import type { DocumentKind } from "../../shared/types/Document";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "../../shared/ui";
import { cn } from "../../shared/utils/cn";
import { countLeaves, MAX_PANES, usePaneLayout } from "..";

export interface PaneHeaderProps {
	paneId: string;
	documentPath: string | null;
	title?: string;
	kind?: DocumentKind;
	className?: string;
}

const MIME_PANE_ID = "application/x-yanta-pane-id";

export const PaneHeader: React.FC<PaneHeaderProps> = ({
	paneId,
	documentPath,
	title: titleProp,
	kind,
	className,
}) => {
	const { layout, activePaneId, splitPane, closePane } = usePaneLayout();
	const density = useDensity();
	const isCompact = density === "compact";

	const isActive = activePaneId === paneId;
	const leafCount = useMemo(() => countLeaves(layout.root), [layout.root]);
	const canSplit = leafCount < MAX_PANES;
	const canClose = leafCount > 1;

	const title = useMemo(() => {
		if (titleProp) return titleProp;
		if (!documentPath) return "Empty";
		const segments = documentPath.split("/");
		const fileName = segments[segments.length - 1] ?? documentPath;
		return fileName.replace(/\.md$/, "");
	}, [titleProp, documentPath]);

	const handleSplitHorizontal = useCallback(() => {
		splitPane(paneId, "horizontal");
	}, [paneId, splitPane]);

	const handleSplitVertical = useCallback(() => {
		splitPane(paneId, "vertical");
	}, [paneId, splitPane]);

	const handleClose = useCallback(() => {
		closePane(paneId);
	}, [paneId, closePane]);

	const handleDragStart = useCallback(
		(e: React.DragEvent) => {
			if (!documentPath) {
				e.preventDefault();
				return;
			}
			e.dataTransfer.setData(MIME_PANE_ID, paneId);
			e.dataTransfer.effectAllowed = "move";
		},
		[paneId, documentPath],
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={cn(
						"bg-glass-bg/40 backdrop-blur-md border-b border-glass-border px-3 flex items-center justify-between shrink-0 transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
						isActive && "border-t-2 border-t-accent",
						!isActive && "border-t-2 border-t-transparent",
						documentPath && "cursor-grab active:cursor-grabbing",
						isCompact ? "h-7" : "h-8",
						className,
					)}
					draggable={!!documentPath}
					onDragStart={handleDragStart}
				>
					<span
						className={cn(
							"truncate mr-2 flex items-center gap-1.5 min-w-0",
							isCompact ? "text-[11px]" : "text-xs",
							documentPath ? "text-text-bright font-medium" : "text-text-dim",
						)}
						title={documentPath ?? undefined}
					>
						{documentPath &&
							(kind === "canvas" ? (
								<PenTool className="w-3.5 h-3.5 shrink-0 text-text-dim" aria-label="Canvas" />
							) : (
								<FileText className="w-3.5 h-3.5 shrink-0 text-text-dim" aria-label="Document" />
							))}
						<span className="truncate">{title}</span>
					</span>

					<div className="flex items-center gap-0.5 shrink-0">
						<button
							type="button"
							className={cn(
								"flex items-center justify-center rounded transition-colors min-w-6 min-h-6",
								canSplit
									? "text-text-dim hover:text-text-bright hover:bg-glass-bg/30"
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
								"flex items-center justify-center rounded transition-colors min-w-6 min-h-6",
								canSplit
									? "text-text-dim hover:text-text-bright hover:bg-glass-bg/30"
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
								className={cn(
									"flex items-center justify-center rounded text-text-dim hover:text-text-bright hover:bg-glass-bg/30 transition-colors min-w-6 min-h-6",
								)}
								onClick={handleClose}
								title="Close pane"
								aria-label="Close pane"
							>
								<X className="w-3.5 h-3.5" />
							</button>
						)}
					</div>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onSelect={handleSplitHorizontal} disabled={!canSplit}>
					Split horizontally
				</ContextMenuItem>
				<ContextMenuItem onSelect={handleSplitVertical} disabled={!canSplit}>
					Split vertically
				</ContextMenuItem>
				{canClose && <ContextMenuItem onSelect={handleClose}>Close pane</ContextMenuItem>}
			</ContextMenuContent>
		</ContextMenu>
	);
};
