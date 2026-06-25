import React from "react";
import { cn } from "../utils/cn";

export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
	variant?: "default" | "sidebar";
}

export const List = React.forwardRef<HTMLUListElement, ListProps>(
	({ className, variant = "default", ...props }, ref) => {
		const baseClasses = "list-none";
		const variantClasses = {
			default: "",
			sidebar: "space-y-0.5",
		};

		return (
			<ul className={cn(baseClasses, variantClasses[variant], className)} ref={ref} {...props} />
		);
	},
);

List.displayName = "List";

export interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
	variant?: "default" | "sidebar" | "selectable";
	active?: boolean;
}

export const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
	({ className, variant = "default", active = false, ...props }, ref) => {
		const baseClasses = "";
		const variantClasses = {
			default: "",
			sidebar:
				"sidebar-item flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:bg-accent/8 hover:text-text mb-1",
			selectable: "cursor-pointer hover:bg-border rounded-md px-2 py-1",
		};

		return (
			<li
				className={cn(
					baseClasses,
					variantClasses[variant],
					active &&
						"active bg-accent/12 text-accent font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);

ListItem.displayName = "ListItem";
