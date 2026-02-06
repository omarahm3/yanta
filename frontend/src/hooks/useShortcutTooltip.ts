import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TIMEOUTS } from "@/config";
import { useTooltipUsage } from "./useTooltipUsage";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipConfig {
	/** Description text to display in the tooltip */
	description: string;
	/** Optional keyboard shortcut to display (e.g., "Ctrl+N", "Cmd+K") */
	shortcut?: string;
	/** Preferred placement of the tooltip relative to the trigger */
	placement?: TooltipPlacement;
	/** Disable the tooltip entirely */
	disabled?: boolean;
}

export interface TooltipProps {
	/** Whether the tooltip should be visible */
	isVisible: boolean;
	/** Description text */
	description: string;
	/** Keyboard shortcut string (if any) */
	shortcut?: string;
	/** Current placement (may differ from preferred if auto-adjusted) */
	placement: TooltipPlacement;
	/** Unique ID for the tooltip element (for aria-describedby) */
	id: string;
	/** Whether the tooltip should render at all (respects usage tracking) */
	shouldRender: boolean;
}

export interface TriggerProps {
	/** Handler for mouse enter */
	onMouseEnter: () => void;
	/** Handler for mouse leave */
	onMouseLeave: () => void;
	/** Handler for focus */
	onFocus: () => void;
	/** Handler for blur */
	onBlur: () => void;
	/** aria-describedby linking to tooltip when visible */
	"aria-describedby"?: string;
}

export interface UseShortcutTooltipReturn {
	/** Props to spread on the tooltip element */
	tooltipProps: TooltipProps;
	/** Props to spread on the trigger element */
	triggerProps: TriggerProps;
	/** Manually show the tooltip */
	show: () => void;
	/** Manually hide the tooltip */
	hide: () => void;
}

/**
 * A hook that provides tooltip behavior with usage tracking.
 * Integrates with the learn-as-you-go tooltip system that fades after repeated exposure.
 *
 * @param tooltipId - Unique identifier for tracking tooltip usage
 * @param config - Configuration for the tooltip
 * @returns Object containing tooltipProps and triggerProps to spread on elements
 *
 * @example
 * ```tsx
 * function SaveButton() {
 *   const { tooltipProps, triggerProps } = useShortcutTooltip("save-btn", {
 *     description: "Save document",
 *     shortcut: "Ctrl+S",
 *   });
 *
 *   return (
 *     <div {...triggerProps}>
 *       <button>Save</button>
 *       {tooltipProps.shouldRender && tooltipProps.isVisible && (
 *         <Tooltip {...tooltipProps} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useShortcutTooltip(
	tooltipId: string,
	config: TooltipConfig,
): UseShortcutTooltipReturn {
	const { description, shortcut, placement = "top", disabled = false } = config;

	const [isVisible, setIsVisible] = useState(false);
	const [hasBeenShown, setHasBeenShown] = useState(false);

	const showTimeoutRef = useRef<number | null>(null);
	const generatedId = useId();
	const ariaId = `tooltip-${generatedId}`;

	const { shouldShowTooltip, recordTooltipView } = useTooltipUsage();

	const shouldRender = !disabled && shouldShowTooltip(tooltipId);

	const clearShowTimeout = useCallback(() => {
		if (showTimeoutRef.current !== null) {
			window.clearTimeout(showTimeoutRef.current);
			showTimeoutRef.current = null;
		}
	}, []);

	const show = useCallback(() => {
		if (disabled || !shouldShowTooltip(tooltipId)) {
			return;
		}
		setIsVisible(true);
	}, [disabled, shouldShowTooltip, tooltipId]);

	const hide = useCallback(() => {
		clearShowTimeout();
		setIsVisible(false);
	}, [clearShowTimeout]);

	const scheduleShow = useCallback(
		(delay: number) => {
			clearShowTimeout();
			showTimeoutRef.current = window.setTimeout(show, delay);
		},
		[clearShowTimeout, show],
	);

	// Record view when tooltip becomes visible for the first time in this session
	useEffect(() => {
		if (isVisible && !hasBeenShown) {
			recordTooltipView(tooltipId);
			setHasBeenShown(true);
		}
	}, [isVisible, hasBeenShown, recordTooltipView, tooltipId]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => clearShowTimeout();
	}, [clearShowTimeout]);

	const handleMouseEnter = useCallback(() => {
		scheduleShow(TIMEOUTS.tooltipHoverDelay);
	}, [scheduleShow]);

	const handleMouseLeave = useCallback(() => {
		hide();
	}, [hide]);

	const handleFocus = useCallback(() => {
		scheduleShow(TIMEOUTS.tooltipFocusDelay);
	}, [scheduleShow]);

	const handleBlur = useCallback(() => {
		hide();
	}, [hide]);

	const tooltipProps: TooltipProps = {
		isVisible,
		description,
		shortcut,
		placement,
		id: ariaId,
		shouldRender,
	};

	const triggerProps: TriggerProps = {
		onMouseEnter: handleMouseEnter,
		onMouseLeave: handleMouseLeave,
		onFocus: handleFocus,
		onBlur: handleBlur,
		"aria-describedby": isVisible && shouldRender ? ariaId : undefined,
	};

	return {
		tooltipProps,
		triggerProps,
		show,
		hide,
	};
}
