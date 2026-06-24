import type React from "react";
import { cn } from "../utils/cn";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
	children: React.ReactNode;
}

/**
 * One flat keycap style shared by the command palette, header, and footers so
 * `<kbd>` can't drift across surfaces. Solid fill + single border, no shadow.
 */
export const Kbd: React.FC<KbdProps> = ({ className, children, ...props }) => (
	<kbd
		className={cn(
			"inline-flex shrink-0 items-center rounded border border-border bg-bg-dark px-1.5 py-0.5 text-[11px] font-mono font-medium text-text-dim",
			className,
		)}
		{...props}
	>
		{children}
	</kbd>
);
