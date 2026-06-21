import { useEffect, useState } from "react";

export type Breakpoint = "sm" | "md" | "lg" | "xl";

const breakpoints: Record<Breakpoint, number> = {
	sm: 640,
	md: 768,
	lg: 900,
	xl: 1200,
};

function getBreakpoint(width: number): Breakpoint {
	if (width < breakpoints.md) return "sm";
	if (width < breakpoints.lg) return "md";
	if (width < breakpoints.xl) return "lg";
	return "xl";
}

export function useResponsive() {
	const [width, setWidth] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth : 1200,
	);
	const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint(width));

	useEffect(() => {
		let rafId: number;
		const handleResize = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const w = window.innerWidth;
				setWidth(w);
				setBreakpoint(getBreakpoint(w));
			});
		};
		window.addEventListener("resize", handleResize);
		return () => {
			cancelAnimationFrame(rafId);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	return {
		width,
		breakpoint,
		isSm: breakpoint === "sm",
		isMd: breakpoint === "md",
		isLg: breakpoint === "lg",
		isXl: breakpoint === "xl",
		isBelowLg: breakpoint === "sm" || breakpoint === "md",
		isBelowMd: breakpoint === "sm",
	};
}
