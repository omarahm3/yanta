import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	variant?: "default" | "ghost";
	error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, variant = "default", type, error, ...props }, ref) => {
		const baseClasses = "input";
		const variantClasses = {
			default: "bg-surface border border-border rounded-md px-3 py-2",
			ghost: "bg-transparent border-none",
		};

		const errorClasses = error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "";

		return (
			<input
				type={type}
				className={cn(baseClasses, variantClasses[variant], errorClasses, className)}
				ref={ref}
				{...props}
			/>
		);
	},
);

Input.displayName = "Input";
