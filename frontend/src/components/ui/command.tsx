import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import * as React from "react";
import { useEffect, useRef } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<
	React.ComponentRef<typeof CommandPrimitive>,
	React.ComponentProps<typeof CommandPrimitive>
>(({ className, loop = true, ...props }, ref) => {
	return (
		<CommandPrimitive
			ref={ref}
			data-slot="command"
			loop={loop}
			className={cn(
				"bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
				className,
			)}
			{...props}
		/>
	);
});
Command.displayName = "Command";

function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	children,
	open,
	...props
}: React.ComponentProps<typeof Dialog> & {
	title?: string;
	description?: string;
}) {
	const commandRef = useRef<HTMLDivElement>(null);

	// Handle Ctrl+N/Ctrl+P keyboard shortcuts by translating them to ArrowDown/ArrowUp
	useEffect(() => {
		if (!open) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
				e.preventDefault();
				// Dispatch ArrowDown event to the command container
				const arrowEvent = new KeyboardEvent("keydown", {
					key: "ArrowDown",
					code: "ArrowDown",
					bubbles: true,
					cancelable: true,
				});
				commandRef.current?.dispatchEvent(arrowEvent);
			} else if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
				e.preventDefault();
				// Dispatch ArrowUp event to the command container
				const arrowEvent = new KeyboardEvent("keydown", {
					key: "ArrowUp",
					code: "ArrowUp",
					bubbles: true,
					cancelable: true,
				});
				commandRef.current?.dispatchEvent(arrowEvent);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	return (
		<Dialog open={open} {...props}>
			<DialogContent className="overflow-hidden p-0" showCloseButton={false}>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{description}</DialogDescription>
				<Command
					ref={commandRef}
					className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
				>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div data-slot="command-input-wrapper" className="flex h-9 items-center gap-2 border-b px-3">
			<SearchIcon className="size-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
			{...props}
		/>
	);
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="py-6 text-center text-sm"
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn("bg-border -mx-1 h-px", className)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
			{...props}
		/>
	);
}

export {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
};
