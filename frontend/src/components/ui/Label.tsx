import React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
	required?: boolean;
	variant?: "default" | "uppercase";
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
	({ className, required, variant = "default", children, ...props }, ref) => {
		const variantClasses = {
			default: "text-sm font-medium text-text",
			uppercase: "text-xs tracking-wider uppercase text-text-dim",
		};

		return (
			<label ref={ref} className={cn("block", variantClasses[variant], className)} {...props}>
				{children}
				{required && <span className="text-red ml-1">*</span>}
			</label>
		);
	},
);

Label.displayName = "Label";
