import type React from "react";
import { cn } from "../utils/cn";

export type CalloutVariant = "warning" | "info" | "danger";

export interface CalloutProps {
	variant?: CalloutVariant;
	icon?: React.ReactNode;
	title?: React.ReactNode;
	children?: React.ReactNode;
	className?: string;
}

const variantStyles: Record<CalloutVariant, { container: string; accent: string }> = {
	warning: { container: "border-yellow/40 bg-yellow/10", accent: "text-yellow" },
	info: { container: "border-accent/40 bg-accent/10", accent: "text-accent" },
	danger: { container: "border-red/40 bg-red/10", accent: "text-red" },
};

/**
 * Single semantic banner for inline notices (warnings, info, destructive state).
 * One border + matching tint — no nested boxes, no heavy shadow. Use this instead
 * of hand-rolling `border-* bg-*` banners so warnings can't drift apart visually.
 */
export const Callout: React.FC<CalloutProps> = ({
	variant = "info",
	icon,
	title,
	children,
	className,
}) => {
	const styles = variantStyles[variant];
	return (
		<div className={cn("rounded-lg border p-4", styles.container, className)}>
			<div className="flex items-start gap-2.5">
				{icon && <span className={cn("mt-0.5 shrink-0", styles.accent)}>{icon}</span>}
				<div className="min-w-0">
					{title && <div className={cn("mb-1 text-sm font-medium", styles.accent)}>{title}</div>}
					{children && <div className="text-sm text-text-dim">{children}</div>}
				</div>
			</div>
		</div>
	);
};
