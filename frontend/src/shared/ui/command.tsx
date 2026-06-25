import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
import * as React from "react";
import { useRef } from "react";
import { cn } from "../utils/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Kbd } from "./Kbd";

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
				className="overflow-hidden p-0 bg-surface border border-border shadow-[var(--elevation-3)] data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 sm:max-w-2xl"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">{description}</DialogDescription>
				<Command ref={commandRef} className="[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0">
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
			className="flex h-14 items-center gap-3 border-b border-border px-4"
		>
			<SearchIcon className="size-5 shrink-0 text-text-dim" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"placeholder:text-text-dim flex h-10 w-full rounded-md bg-transparent py-3 text-lg outline-none disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
			{showEscBadge && <Kbd className="px-2 py-1 text-xs">ESC</Kbd>}
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn("max-h-[480px] scroll-py-1 overflow-x-hidden overflow-y-auto p-1.5", className)}
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
				"text-text [&_[cmdk-group-heading]]:text-text-dim/80 overflow-hidden px-1 py-0.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
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
				"data-[selected=true]:bg-accent/12 data-[selected=true]:text-accent [&_svg:not([class*='text-'])]:text-text-dim relative flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 transition-colors duration-150",
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
			className={cn("ml-auto text-xs tracking-widest text-text-dim/60", className)}
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
