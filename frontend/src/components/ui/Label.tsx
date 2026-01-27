import * as LabelPrimitive from "@radix-ui/react-label";
import React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
	required?: boolean;
	variant?: "default" | "uppercase";
}

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
	({ className, required, variant = "default", children, ...props }, ref) => {
		const variantClasses = {
			default: "text-sm font-medium text-text",
			uppercase: "text-xs tracking-wider uppercase text-text-dim",
		};

		return (
			<LabelPrimitive.Root
				ref={ref}
				className={cn("block", variantClasses[variant], className)}
				{...props}
			>
				{children}
				{required && <span className="text-red ml-1">*</span>}
			</LabelPrimitive.Root>
		);
	},
);

Label.displayName = "Label";
