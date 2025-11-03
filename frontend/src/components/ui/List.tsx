import React from "react";
import { cn } from "../../lib/utils";

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
			sidebar: "sidebar-item",
			selectable: "cursor-pointer hover:bg-border rounded-md px-2 py-1",
		};

		return (
			<li
				className={cn(baseClasses, variantClasses[variant], active && "active", className)}
				ref={ref}
				{...props}
			/>
		);
	},
);

ListItem.displayName = "ListItem";
