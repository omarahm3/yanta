import { FileText } from "lucide-react";
import type React from "react";
import { cn } from "../../shared/utils/cn";

export interface EmptyPaneProps {
	className?: string;
	/** Whether a dragged item is currently hovering over this pane */
	isDragOver?: boolean;
}

/**
 * EmptyPane displays a centered prompt encouraging the user to open
 * a document in this pane, with instructions for keyboard shortcut
 * and drag-and-drop.
 */
export const EmptyPane: React.FC<EmptyPaneProps> = ({ className, isDragOver = false }) => {
	return (
		<div
			className={cn(
				"flex flex-1 flex-col items-center justify-center gap-4 text-text-dim select-none transition-colors",
				isDragOver && "bg-accent/5",
				className,
			)}
		>
			<FileText
				className={cn("w-10 h-10 transition-opacity", isDragOver ? "opacity-40" : "opacity-20")}
				aria-hidden="true"
			/>

			<div className="flex flex-col items-center gap-2 text-center px-4">
				{isDragOver ? (
					<p className="text-sm font-medium text-accent">Drop to open here</p>
				) : (
					<>
						<p className="text-sm font-medium text-text-dim">No document open</p>
						<p className="text-xs opacity-60 max-w-[220px] leading-relaxed">
							Press{" "}
							<kbd className="bg-glass-bg/30 backdrop-blur-sm px-1.5 py-0.5 rounded font-mono border border-glass-border text-text-dim">
								Ctrl+K
							</kbd>{" "}
							to open a document, or drag one here from the sidebar.
						</p>
					</>
				)}
			</div>
		</div>
	);
};
