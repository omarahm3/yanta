import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import { useMergedConfig } from "@/shared/stores/preferences.store";
import { useShortcutTooltipsSetting, useTooltipUsage } from "../hooks";
import { cn } from "../utils/cn";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
	/** Unique identifier for tracking tooltip usage */
	tooltipId: string;
	/** Content to display in the tooltip */
	content: ReactNode;
	/** Optional keyboard shortcut to display (e.g., "Ctrl+N", "Cmd+K") */
	shortcut?: string;
	/** Preferred placement of the tooltip relative to the trigger */
	placement?: TooltipPlacement;
	/** Custom delay in milliseconds before showing tooltip on hover (default: 500) */
	delay?: number;
	/** The trigger element that the tooltip is anchored to */
	children: ReactNode;
	/** Disable the tooltip entirely (useful for conditional rendering) */
	disabled?: boolean;
}

function parseShortcut(shortcut: string): string[] {
	return shortcut.split("+").map((key) => key.trim());
}

export const Tooltip: React.FC<TooltipProps> = ({
	tooltipId,
	content,
	shortcut,
	placement = "top",
	delay: delayProp,
	children,
	disabled = false,
}) => {
	const { timeouts } = useMergedConfig();
	const delay = delayProp ?? timeouts.tooltipHoverDelay;

	const [hasBeenShown, setHasBeenShown] = useState(false);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	const { showShortcutTooltips } = useShortcutTooltipsSetting();
	const { shouldShowTooltip, recordTooltipView } = useTooltipUsage({
		globalDisabled: !showShortcutTooltips,
	});

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		setPrefersReducedMotion(mediaQuery.matches);

		const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, []);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (disabled || !shouldShowTooltip(tooltipId)) {
				setIsOpen(false);
				return;
			}

			setIsOpen(open);

			if (open && !hasBeenShown) {
				recordTooltipView(tooltipId);
				setHasBeenShown(true);
			}
		},
		[disabled, shouldShowTooltip, tooltipId, hasBeenShown, recordTooltipView],
	);

	const shouldRender = !disabled && shouldShowTooltip(tooltipId);

	if (!shouldRender) {
		return <>{children}</>;
	}

	const shortcutKeys = shortcut ? parseShortcut(shortcut) : [];

	return (
		<TooltipPrimitive.Provider delayDuration={delay} skipDelayDuration={0}>
			<TooltipPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} delayDuration={delay}>
				<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
				<TooltipPrimitive.Portal>
					<TooltipPrimitive.Content
						side={placement}
						sideOffset={timeouts.tooltipOffset}
						className={cn(
							"z-[9999] px-3 py-2 text-sm rounded-md shadow-lg",
							"bg-glass-bg/90 backdrop-blur-xl border border-glass-border text-text",
							"pointer-events-none",
							prefersReducedMotion
								? "opacity-100"
								: [
										"transition-all duration-150 ease-out",
										"data-[state=delayed-open]:opacity-100 data-[state=closed]:opacity-0",
										"data-[side=top]:data-[state=delayed-open]:translate-y-0 data-[side=top]:data-[state=closed]:translate-y-1",
										"data-[side=bottom]:data-[state=delayed-open]:translate-y-0 data-[side=bottom]:data-[state=closed]:-translate-y-1",
										"data-[side=left]:data-[state=delayed-open]:translate-x-0 data-[side=left]:data-[state=closed]:translate-x-1",
										"data-[side=right]:data-[state=delayed-open]:translate-x-0 data-[side=right]:data-[state=closed]:-translate-x-1",
									],
						)}
					>
						<div className="flex items-center gap-2">
							<span>{content}</span>
							{shortcutKeys.length > 0 && (
								<div className="flex items-center gap-0.5">
									{shortcutKeys.map((key, index) => (
										<React.Fragment key={key}>
											{index > 0 && <span className="text-text-dim text-xs">+</span>}
											<kbd className="bg-glass-bg/30 backdrop-blur-sm border border-glass-border rounded px-1.5 py-0.5 text-xs font-mono text-cyan">
												{key}
											</kbd>
										</React.Fragment>
									))}
								</div>
							)}
						</div>
					</TooltipPrimitive.Content>
				</TooltipPrimitive.Portal>
			</TooltipPrimitive.Root>
		</TooltipPrimitive.Provider>
	);
};

Tooltip.displayName = "Tooltip";
