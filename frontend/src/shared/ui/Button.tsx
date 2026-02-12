import React from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "ghost" | "destructive";
	size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "md", ...props }, ref) => {
		const baseClasses = "btn";
		const variantClasses = {
			primary: "btn-primary",
			secondary: "btn-secondary",
			ghost:
				"bg-transparent hover:bg-glass-bg hover:text-text active:scale-95 text-text-dim transition-all",
			destructive: "bg-red text-bg hover:bg-red/90 shadow-md",
		};
		const sizeClasses = {
			sm: "px-3 py-1.5 text-sm",
			md: "px-4 py-2 text-sm",
			lg: "px-6 py-3 text-base",
		};

		return (
			<button
				className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
				ref={ref}
				{...props}
			/>
		);
	},
);

Button.displayName = "Button";
