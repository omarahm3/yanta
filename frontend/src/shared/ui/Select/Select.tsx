import React from "react";
import { cn } from "../../utils/cn";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Select as ShadcnSelect,
} from "./primitives";

export interface SelectOption {
	value: string;
	label: string;
}

export interface SelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	disabled?: boolean;
	className?: string;
	variant?: "default" | "ghost";
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
	({ value, onChange, options, disabled = false, className, variant = "default" }, ref) => {
		const variantClasses = {
			default: "",
			ghost: "bg-transparent border-none shadow-none",
		};

		if (import.meta.env.DEV) {
			const emptyValueOption = options.find((o) => o.value === "");
			if (emptyValueOption) {
				throw new Error(
					`Select: option with empty-string value is not allowed (label="${emptyValueOption.label}"). ` +
						"Radix reserves empty string to clear selection. Use a sentinel value (e.g. '__none__') and map to '' at the call site.",
				);
			}
		}

		return (
			<ShadcnSelect value={value} onValueChange={onChange} disabled={disabled}>
				<SelectTrigger ref={ref} className={cn("w-full", variantClasses[variant], className)}>
					<SelectValue placeholder="Select..." />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</ShadcnSelect>
		);
	},
);

Select.displayName = "Select";
