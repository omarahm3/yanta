import type React from "react";
import { cn } from "../utils/cn";

interface StatusBarItemProps extends React.HTMLAttributes<HTMLSpanElement> {
	/** Short, fixed label for the metric (e.g. "Docs", "Project"). */
	label: string;
	/** The glanceable value. */
	value: React.ReactNode;
	/** Full descriptive text shown as a native tooltip on hover. */
	title?: string;
	/** Primary metrics read brighter/heavier so the eye lands on them first. */
	primary?: boolean;
}

/**
 * A single status-bar metric: quiet by default, informative on hover.
 *
 * The value is the glanceable element; the label stays dim until the item is
 * hovered, and a native tooltip carries the fully spelled-out detail. Keeping
 * the label always rendered (just dimmed) avoids layout shift on hover.
 */
export const StatusBarItem: React.FC<StatusBarItemProps> = ({
	label,
	value,
	title,
	primary = false,
	className,
	...props
}) => {
	const tooltip =
		title ?? (typeof value === "string" || typeof value === "number" ? `${label}: ${value}` : label);

	return (
		<span
			title={tooltip}
			className={cn("group/sbitem inline-flex items-baseline gap-1.5 whitespace-nowrap", className)}
			{...props}
		>
			<span className="text-[10px] uppercase tracking-wider text-text-dim/60 transition-colors group-hover/sbitem:text-text-dim">
				{label}
			</span>
			<span
				className={cn(
					"tabular-nums text-text-dim transition-colors group-hover/sbitem:text-text",
					primary && "font-medium text-text",
				)}
			>
				{value}
			</span>
		</span>
	);
};
