import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import * as React from "react";
import { useRef } from "react";

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
			className={cn("text-text flex h-full w-full flex-col overflow-hidden rounded-xl", className)}
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

	return (
		<Dialog open={open} {...props}>
			<DialogContent
				className="overflow-hidden p-0 bg-glass-bg/90 backdrop-blur-xl border border-glass-border shadow-2xl sm:max-w-xl"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{description}</DialogDescription>
				<Command
					ref={commandRef}
					className="[&_[cmdk-group-heading]]:text-text-dim/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-6 [&_[cmdk-input-wrapper]_svg]:w-6 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-4 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
				>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	showEscBadge = true,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
	showEscBadge?: boolean;
}) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="flex h-16 items-center gap-3 border-b border-glass-border px-4"
		>
			<SearchIcon className="size-5 shrink-0 text-text-dim" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"placeholder:text-text-dim/60 flex h-10 w-full rounded-md bg-transparent py-3 text-lg outline-none disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
			{showEscBadge && (
				<kbd className="shrink-0 rounded border border-glass-border bg-bg-dark/30 px-2 py-1 text-xs font-semibold text-text-dim shadow-sm">
					ESC
				</kbd>
			)}
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn("max-h-[400px] scroll-py-1 overflow-x-hidden overflow-y-auto p-2", className)}
			{...props}
		/>
	);
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="py-12 text-center text-sm text-text-dim"
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
				"text-text [&_[cmdk-group-heading]]:text-text-dim overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
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
			className={cn("bg-glass-border -mx-1 h-px", className)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"data-[selected=true]:bg-accent/10 data-[selected=true]:text-accent-foreground data-[selected=true]:border-l-2 data-[selected=true]:border-accent [&_svg:not([class*='text-'])]:text-text-dim relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 transition-all duration-200",
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
			className={cn(
				"ml-auto text-xs tracking-widest text-text-dim/80 bg-bg-dark/40 border border-glass-border px-1.5 py-0.5 rounded shadow-sm",
				className,
			)}
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
