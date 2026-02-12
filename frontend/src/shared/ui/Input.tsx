import React from "react";
import { cn } from "../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	variant?: "default" | "ghost";
	error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, variant = "default", type, error, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"input w-full bg-glass-bg/20 backdrop-blur-sm border-glass-border focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-text-dim/50",
					variant === "ghost" && "bg-transparent border-none shadow-none",
					error && "border-red-500 focus:border-red-500 focus:ring-red-500",
					type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);

Input.displayName = "Input";
