import { Switch } from "@headlessui/react";
import type React from "react";
import { cn } from "../../lib/utils";

export interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
	checked,
	onChange,
	disabled = false,
	className,
}) => {
	return (
		<Switch
			checked={checked}
			onChange={(value) => {
				if (!disabled) {
					onChange(value);
				}
			}}
			className={cn(
				"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg",
				checked ? "bg-green border-green" : "bg-bg border-border",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
			type="button"
			disabled={disabled}
		>
			<span className="sr-only">Toggle option</span>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
					checked ? "translate-x-6" : "translate-x-1",
				)}
			/>
		</Switch>
	);
};
