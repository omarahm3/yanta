import React from "react";
import { cn } from "../../lib/utils";

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
	as?: "p" | "span" | "div" | "strong" | "em" | "small";
	variant?: "default" | "dim" | "bright" | "error" | "success" | "warning";
	size?: "xs" | "sm" | "base" | "lg" | "xl";
	weight?: "normal" | "medium" | "semibold" | "bold";
	children: React.ReactNode;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
	(
		{
			as: Component = "p",
			variant = "default",
			size = "base",
			weight = "normal",
			className,
			children,
			...props
		},
		ref,
	) => {
		const variantClasses = {
			default: "text-text",
			dim: "text-text-dim",
			bright: "text-text-bright",
			error: "text-red",
			success: "text-green",
			warning: "text-yellow",
		};

		const sizeClasses = {
			xs: "text-xs",
			sm: "text-sm",
			base: "text-base",
			lg: "text-lg",
			xl: "text-xl",
		};

		const weightClasses = {
			normal: "font-normal",
			medium: "font-medium",
			semibold: "font-semibold",
			bold: "font-bold",
		};

		return React.createElement(
			Component,
			{
				ref: ref as any,
				className: cn(variantClasses[variant], sizeClasses[size], weightClasses[weight], className),
				...props,
			},
			children,
		);
	},
);

Text.displayName = "Text";
