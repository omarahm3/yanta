import type React from "react";
import { cn } from "../utils/cn";

interface SkeletonProps {
	className?: string;
	style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, style }) => (
	<div className={cn("motion-safe:animate-pulse rounded bg-glass-bg/30", className)} style={style} />
);
