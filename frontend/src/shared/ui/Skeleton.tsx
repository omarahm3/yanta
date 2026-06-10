import type React from "react";
import { cn } from "../utils/cn";

interface SkeletonProps {
	/** Extra classes for sizing/shape (width, height, rounding). */
	className?: string;
	style?: React.CSSProperties;
}

/**
 * Skeleton is a neutral placeholder block that pulses while content loads.
 * Compose multiple Skeletons to mirror the final layout so swapping in real
 * content causes no layout shift.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className, style }) => {
	return (
		<div
			aria-hidden="true"
			className={cn("animate-pulse rounded bg-glass-bg/30", className)}
			style={style}
		/>
	);
};
