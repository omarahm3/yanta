import React, {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useTooltipUsage } from "../../hooks/useTooltipUsage";
import { cn } from "../../lib/utils";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

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

interface TooltipPosition {
	top: number;
	left: number;
	placement: TooltipPlacement;
}

const HOVER_DELAY = 500;
const FOCUS_DELAY = 800;
const TOOLTIP_OFFSET = 8;

/**
 * Calculates the best position for the tooltip, auto-adjusting to stay in viewport
 */
function calculatePosition(
	triggerRect: DOMRect,
	tooltipRect: DOMRect,
	preferredPlacement: TooltipPlacement,
): TooltipPosition {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	const positions: Record<TooltipPlacement, { top: number; left: number }> = {
		top: {
			top: triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET,
			left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
		},
		bottom: {
			top: triggerRect.bottom + TOOLTIP_OFFSET,
			left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
		},
		left: {
			top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
			left: triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET,
		},
		right: {
			top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
			left: triggerRect.right + TOOLTIP_OFFSET,
		},
	};

	const fitsInViewport = (pos: { top: number; left: number }): boolean => {
		return (
			pos.top >= 0 &&
			pos.left >= 0 &&
			pos.top + tooltipRect.height <= viewportHeight &&
			pos.left + tooltipRect.width <= viewportWidth
		);
	};

	// Try preferred placement first
	if (fitsInViewport(positions[preferredPlacement])) {
		return { ...positions[preferredPlacement], placement: preferredPlacement };
	}

	// Try opposite placement
	const opposites: Record<TooltipPlacement, TooltipPlacement> = {
		top: "bottom",
		bottom: "top",
		left: "right",
		right: "left",
	};
	const opposite = opposites[preferredPlacement];
	if (fitsInViewport(positions[opposite])) {
		return { ...positions[opposite], placement: opposite };
	}

	// Try remaining placements
	const remaining = (["top", "bottom", "left", "right"] as TooltipPlacement[]).filter(
		(p) => p !== preferredPlacement && p !== opposite,
	);
	for (const placement of remaining) {
		if (fitsInViewport(positions[placement])) {
			return { ...positions[placement], placement };
		}
	}

	// Fallback: use preferred placement but clamp to viewport
	const pos = positions[preferredPlacement];
	return {
		top: Math.max(0, Math.min(pos.top, viewportHeight - tooltipRect.height)),
		left: Math.max(0, Math.min(pos.left, viewportWidth - tooltipRect.width)),
		placement: preferredPlacement,
	};
}

/**
 * Parse a shortcut string into individual keys for display
 */
function parseShortcut(shortcut: string): string[] {
	return shortcut.split("+").map((key) => key.trim());
}

/**
 * A tooltip component that displays description text and optional keyboard shortcuts.
 * Integrates with the tooltip usage tracking system to fade after repeated exposure.
 */
export const ShortcutTooltip: React.FC<ShortcutTooltipProps> = ({
	tooltipId,
	description,
	shortcut,
	placement = "top",
	children,
	className,
	disabled = false,
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [hasBeenShown, setHasBeenShown] = useState(false);
	const [position, setPosition] = useState<TooltipPosition | null>(null);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	const triggerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const showTimeoutRef = useRef<number | null>(null);
	const generatedId = useId();
	const ariaId = `tooltip-${generatedId}`;

	const { shouldShowTooltip, recordTooltipView } = useTooltipUsage();

	// Check for reduced motion preference
	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		setPrefersReducedMotion(mediaQuery.matches);

		const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, []);

	const clearShowTimeout = useCallback(() => {
		if (showTimeoutRef.current !== null) {
			window.clearTimeout(showTimeoutRef.current);
			showTimeoutRef.current = null;
		}
	}, []);

	const showTooltip = useCallback(() => {
		if (disabled || !shouldShowTooltip(tooltipId)) {
			return;
		}
		setIsVisible(true);
	}, [disabled, shouldShowTooltip, tooltipId]);

	const hideTooltip = useCallback(() => {
		clearShowTimeout();
		setIsVisible(false);
	}, [clearShowTimeout]);

	const scheduleShow = useCallback(
		(delay: number) => {
			clearShowTimeout();
			showTimeoutRef.current = window.setTimeout(showTooltip, delay);
		},
		[clearShowTimeout, showTooltip],
	);

	// Record view when tooltip becomes visible for the first time in this session
	useEffect(() => {
		if (isVisible && !hasBeenShown) {
			recordTooltipView(tooltipId);
			setHasBeenShown(true);
		}
	}, [isVisible, hasBeenShown, recordTooltipView, tooltipId]);

	// Update position when tooltip becomes visible
	useEffect(() => {
		if (!isVisible || !triggerRef.current || !tooltipRef.current) {
			return;
		}

		const updatePosition = () => {
			if (!triggerRef.current || !tooltipRef.current) return;

			const triggerRect = triggerRef.current.getBoundingClientRect();
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			const newPosition = calculatePosition(triggerRect, tooltipRect, placement);
			setPosition(newPosition);
		};

		// Use requestAnimationFrame to ensure the tooltip is rendered before measuring
		requestAnimationFrame(updatePosition);

		// Update position on scroll/resize
		window.addEventListener("scroll", updatePosition, true);
		window.addEventListener("resize", updatePosition);

		return () => {
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
		};
	}, [isVisible, placement]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => clearShowTimeout();
	}, [clearShowTimeout]);

	const handleMouseEnter = () => scheduleShow(HOVER_DELAY);
	const handleMouseLeave = () => hideTooltip();
	const handleFocus = () => scheduleShow(FOCUS_DELAY);
	const handleBlur = () => hideTooltip();

	// Don't render tooltip if disabled or shouldn't show due to usage tracking
	const shouldRender = !disabled && shouldShowTooltip(tooltipId);

	const shortcutKeys = shortcut ? parseShortcut(shortcut) : [];

	const tooltipContent = isVisible && shouldRender && (
		<div
			ref={tooltipRef}
			id={ariaId}
			role="tooltip"
			className={cn(
				"fixed z-[9999] px-3 py-2 text-sm rounded-md shadow-lg",
				"bg-surface border border-border text-text",
				"pointer-events-none",
				// Animation classes
				prefersReducedMotion
					? "opacity-100"
					: [
							"transition-all duration-150 ease-out",
							isVisible ? "opacity-100" : "opacity-0",
							position?.placement === "top" && (isVisible ? "translate-y-0" : "translate-y-1"),
							position?.placement === "bottom" &&
								(isVisible ? "translate-y-0" : "-translate-y-1"),
							position?.placement === "left" && (isVisible ? "translate-x-0" : "translate-x-1"),
							position?.placement === "right" &&
								(isVisible ? "translate-x-0" : "-translate-x-1"),
						],
			)}
			style={
				position
					? {
							top: position.top,
							left: position.left,
						}
					: {
							visibility: "hidden",
						}
			}
		>
			<div className="flex items-center gap-2">
				<span>{description}</span>
				{shortcutKeys.length > 0 && (
					<div className="flex items-center gap-0.5">
						{shortcutKeys.map((key, index) => (
							<React.Fragment key={key}>
								{index > 0 && <span className="text-text-dim text-xs">+</span>}
								<kbd className="bg-bg border border-border rounded px-1.5 py-0.5 text-xs font-mono text-cyan">
									{key}
								</kbd>
							</React.Fragment>
						))}
					</div>
				)}
			</div>
		</div>
	);

	return (
		<>
			<div
				ref={triggerRef}
				className={cn("inline-block", className)}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onFocus={handleFocus}
				onBlur={handleBlur}
				aria-describedby={isVisible && shouldRender ? ariaId : undefined}
			>
				{children}
			</div>
			{tooltipContent && createPortal(tooltipContent, document.body)}
		</>
	);
};

ShortcutTooltip.displayName = "ShortcutTooltip";
