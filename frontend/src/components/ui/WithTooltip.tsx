import type { ReactElement } from "react";
import { Tooltip, type TooltipPlacement } from "./Tooltip";

export interface WithTooltipProps {
	/** Unique identifier for tracking tooltip usage */
	tooltipId: string;
	/** Description text to display in the tooltip */
	description: string;
	/** Optional keyboard shortcut to display (e.g., "Ctrl+N", "Cmd+K") */
	shortcut?: string;
	/** Preferred placement of the tooltip relative to the trigger */
	placement?: TooltipPlacement;
	/** The trigger element - must be a single React element that accepts event handlers */
	children: ReactElement;
	/** Disable the tooltip entirely (useful for conditional rendering) */
	disabled?: boolean;
}

export const WithTooltip: React.FC<WithTooltipProps> = ({
	tooltipId,
	description,
	shortcut,
	placement = "top",
	children,
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
			{children}
		</Tooltip>
	);
};

WithTooltip.displayName = "WithTooltip";
