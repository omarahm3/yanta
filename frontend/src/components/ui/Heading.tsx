import React from "react";
import { cn } from "../../lib/utils";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
	variant?: "default" | "accent" | "dim" | "bright";
	size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
	weight?: "normal" | "medium" | "semibold" | "bold";
	children: React.ReactNode;
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
	(
		{
			as: Component = "h2",
			variant = "default",
			size,
			weight = "semibold",
			className,
			children,
			...props
		},
		ref
	) => {
		const variantClasses = {
			default: "text-text",
			accent: "text-accent",
			dim: "text-text-dim",
			bright: "text-text-bright",
		};

		// Default sizes based on heading level if not specified
		const defaultSizes = {
			h1: "3xl",
			h2: "2xl",
			h3: "xl",
			h4: "lg",
			h5: "base",
			h6: "sm",
		};

		const actualSize = size || defaultSizes[Component];

		const sizeClasses = {
			xs: "text-xs",
			sm: "text-sm",
			base: "text-base",
			lg: "text-lg",
			xl: "text-xl",
			"2xl": "text-2xl",
			"3xl": "text-3xl",
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
				ref,
				className: cn(
					variantClasses[variant],
					sizeClasses[actualSize as keyof typeof sizeClasses],
					weightClasses[weight],
					className
				),
				...props,
			},
			children
		);
	}
);

Heading.displayName = "Heading";