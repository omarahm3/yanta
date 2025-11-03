import type React from "react";
import { cn } from "../../lib/utils";

export interface ContextItem {
	label: string;
	value: string;
	color?: string;
}

export interface Shortcut {
	key: string;
	label: string;
}

export interface ContextBarProps {
	contextItems: ContextItem[];
	shortcuts?: Shortcut[];
	className?: string;
}

export const ContextBar: React.FC<ContextBarProps> = ({
	contextItems,
	shortcuts = [],
	className,
}) => {
	return (
		<div
			className={cn(
				"bg-bg border-b border-border px-5 py-2 flex items-center justify-between text-xs text-text-dim",
				className,
			)}
		>
			<div className="flex items-center gap-4">
				{contextItems.map((item, index) => (
					<div key={index} className="flex items-center gap-2">
						<div
							className="w-1.5 h-1.5 rounded-full"
							style={{ backgroundColor: item.color || "#a371f7" }}
						/>
						<span className="text-text font-medium text-sm">{item.value}</span>
					</div>
				))}
			</div>

			{shortcuts.length > 0 && (
				<div className="flex gap-4">
					{shortcuts.map((shortcut, index) => (
						<div key={index} className="flex items-center gap-1">
							<kbd className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono border border-border">
								{shortcut.key}
							</kbd>
							<span className="font-mono opacity-50 text-xs">{shortcut.label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
