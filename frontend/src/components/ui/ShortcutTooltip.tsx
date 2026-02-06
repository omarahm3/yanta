import type { ReactNode } from "react";
import { Tooltip, type TooltipPlacement } from "./Tooltip";

export interface ShortcutTooltipProps {
	/** Unique identifier for tracking tooltip usage */
	tooltipId: string;
	/** Description text to display in the tooltip */
	description: string;
	/** Optional keyboard shortcut to display (e.g., "Ctrl+N", "Cmd+K") */
	shortcut?: string;
	/** Preferred placement of the tooltip relative to the trigger */
	placement?: TooltipPlacement;
	/** The trigger element that the tooltip is anchored to */
	children: ReactNode;
	/** Additional class name for the wrapper */
	className?: string;
	/** Disable the tooltip entirely (useful for conditional rendering) */
	disabled?: boolean;
}

export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({
	tooltipId,
	description,
	shortcut,
	placement = "top",
	children,
	className,
	disabled = false,
}) => {
	return (
		<Tooltip
			tooltipId={tooltipId}
			content={description}
			shortcut={shortcut}
			placement={placement}
			disabled={disabled}
		>
			<div className={className}>{children}</div>
		</Tooltip>
	);
};

ShortcutTooltip.displayName = "ShortcutTooltip";
