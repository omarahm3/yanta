import type React from "react";
import { cn } from "../utils/cn";

export interface HeaderBarProps {
	breadcrumb: string;
	currentPage: string;
	projectAlias?: string;
	shortcuts?: Array<{
		key: string;
		label: string;
	}>;
	className?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
	breadcrumb,
	currentPage,
	projectAlias,
	shortcuts = [],
	className,
}) => {
	return (
		<div
			className={cn(
				"bg-glass-bg/40 backdrop-blur-md border-b border-glass-border px-5 py-3 flex items-center justify-between",
				className,
			)}
			style={{ "--wails-draggable": "drag" } as React.CSSProperties}
		>
			<div className="text-text-dim text-sm">
				{breadcrumb} / <span className="text-text-bright font-semibold">{currentPage}</span>
				{projectAlias && <span className="text-text-dim ml-2">{projectAlias}</span>}
			</div>
			<div className="flex gap-4 text-xs text-text-dim">
				{shortcuts.map((shortcut) => (
					<span key={shortcut.key} className="flex items-center gap-1">
						<kbd className="bg-glass-bg/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs border border-glass-border">
							{shortcut.key}
						</kbd>
						{shortcut.label}
					</span>
				))}
			</div>
		</div>
	);
};
