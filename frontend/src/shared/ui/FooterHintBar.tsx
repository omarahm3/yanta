import type React from "react";
import { cn } from "../utils/cn";

export interface FooterHint {
	key: string;
	label: string;
	/**
	 * Priority level for responsive disclosure.
	 * - 1: Always visible
	 * - 2: Always visible (wrapping handles overflow)
	 * - 3: Hidden below 768px
	 * Defaults to 2 if not specified.
	 */
	priority?: 1 | 2 | 3;
}

export interface FooterHintBarProps {
	hints: FooterHint[];
	className?: string;
}

/**
 * Returns the responsive CSS classes for a hint based on its priority.
 */
function priorityClasses(priority: 1 | 2 | 3): string {
	switch (priority) {
		case 1:
			return "flex";
		case 2:
			return "flex";
		case 3:
			return "hidden md:flex";
	}
}

/**
 * FooterHintBar displays context-aware keyboard shortcut hints at the bottom of the viewport.
 * It uses CSS-based progressive disclosure based on hint priority.
 * Flex-wrap handles overflow naturally; only P3 hints are hidden on small viewports.
 *
 * - P1: always visible
 * - P2: always visible (wrapping handles overflow)
 * - P3: hidden below 768px (md)
 */
export const FooterHintBar: React.FC<FooterHintBarProps> = ({ hints, className }) => {
	if (hints.length === 0) {
		return null;
	}

	return (
		<div
			data-testid="footer-hint-bar"
			className={cn(
				"min-h-8 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs bg-glass-bg/60 backdrop-blur-md border-t border-glass-border text-text-dim z-40",
				className,
			)}
		>
			{hints.map((hint) => {
				const priority = hint.priority ?? 2;

				return (
					<div
						key={`${hint.key}-${hint.label}`}
						className={cn("items-center gap-1", priorityClasses(priority))}
						data-priority={priority}
					>
						<kbd className="font-mono text-[10px] bg-glass-bg/30 backdrop-blur-sm px-1 py-0.5 rounded mr-1 text-text-dim border border-glass-border">
							{hint.key}
						</kbd>
						<span>{hint.label}</span>
					</div>
				);
			})}
		</div>
	);
};
