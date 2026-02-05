import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

export interface FooterHint {
	key: string;
	label: string;
	/**
	 * Priority level for responsive collapse behavior.
	 * Priority 1 hints are always shown, even on narrow viewports.
	 * Priority 2+ hints are hidden on viewports < 768px.
	 * Defaults to 2 if not specified.
	 */
	priority?: 1 | 2 | 3;
}

export interface FooterHintBarProps {
	hints: FooterHint[];
	className?: string;
}

/** Breakpoint for narrow viewport detection (768px) */
const NARROW_VIEWPORT_BREAKPOINT = 768;

/**
 * Hook to detect if the viewport is narrow (< 768px)
 */
function useIsNarrowViewport(): boolean {
	const [isNarrow, setIsNarrow] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.innerWidth < NARROW_VIEWPORT_BREAKPOINT;
	});

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(max-width: ${NARROW_VIEWPORT_BREAKPOINT - 1}px)`);

		const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
			setIsNarrow(e.matches);
		};

		// Set initial value
		handleChange(mediaQuery);

		// Listen for changes
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	return isNarrow;
}

/**
 * FooterHintBar displays context-aware keyboard shortcut hints at the bottom of the viewport.
 * It renders each hint as a pill showing the key (styled as keyboard badge) followed by the label.
 *
 * On narrow viewports (< 768px), only priority 1 hints are shown.
 */
export const FooterHintBar: React.FC<FooterHintBarProps> = ({ hints, className }) => {
	const isNarrowViewport = useIsNarrowViewport();

	const filteredHints = useMemo(() => {
		if (!isNarrowViewport) {
			return hints;
		}
		// On narrow viewports, only show priority 1 hints
		return hints.filter((hint) => hint.priority === 1);
	}, [hints, isNarrowViewport]);

	if (filteredHints.length === 0) {
		return null;
	}

	return (
		<div
			data-testid="footer-hint-bar"
			className={cn(
				"fixed bottom-0 left-0 right-0 h-8 flex items-center gap-4 px-4 text-xs bg-glass-bg/60 backdrop-blur-md border-t border-glass-border text-text-dim z-40",
				className,
			)}
		>
			{filteredHints.map((hint) => (
				<div
					key={`${hint.key}-${hint.label}`}
					className="flex items-center gap-1"
					data-priority={hint.priority ?? 2}
				>
					<kbd className="font-mono bg-glass-bg/30 backdrop-blur-sm px-1.5 py-0.5 rounded mr-1 text-text-dim border border-glass-border">
						{hint.key}
					</kbd>
					<span>{hint.label}</span>
				</div>
			))}
		</div>
	);
};
