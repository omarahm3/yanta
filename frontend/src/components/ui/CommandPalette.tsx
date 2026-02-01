import type React from "react";
import { useCallback, useMemo } from "react";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";

export interface CommandOption {
	id: string;
	icon: React.ReactNode;
	text: string;
	hint?: string;
	shortcut?: string;
	group?: string;
	keywords?: string[];
	action: () => void;
}

// Define the canonical group order
const GROUP_ORDER = [
	"Navigation",
	"Create",
	"Document",
	"Git",
	"Projects",
	"Application",
] as const;

type GroupName = (typeof GROUP_ORDER)[number];

// Helper to sort commands by group
function groupCommands(commands: CommandOption[]): Map<string, CommandOption[]> {
	const grouped = new Map<string, CommandOption[]>();

	// Initialize groups in order
	for (const groupName of GROUP_ORDER) {
		grouped.set(groupName, []);
	}
	// Add an "Other" group for commands without a group
	grouped.set("Other", []);

	// Assign commands to groups
	for (const command of commands) {
		const group = command.group || "Other";
		const groupCommands = grouped.get(group);
		if (groupCommands) {
			groupCommands.push(command);
		} else {
			// Unknown group, add to Other
			grouped.get("Other")?.push(command);
		}
	}

	// Remove empty groups
	for (const [groupName, cmds] of grouped) {
		if (cmds.length === 0) {
			grouped.delete(groupName);
		}
	}

	return grouped;
}

export interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onCommandSelect: (command: CommandOption) => void;
	commands: CommandOption[];
	placeholder?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onCommandSelect,
	commands,
	placeholder = "Type a command...",
}) => {
	const handleSelect = useCallback(
		(command: CommandOption) => {
			command.action();
			onCommandSelect(command);
			onClose();
		},
		[onCommandSelect, onClose],
	);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);

	// Group commands by their group property
	const groupedCommands = useMemo(() => groupCommands(commands), [commands]);

	return (
		<CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
			<CommandInput placeholder={placeholder} />
			<CommandList>
				<CommandEmpty>No commands found.</CommandEmpty>
				{Array.from(groupedCommands.entries()).map(([groupName, groupCmds]) => (
					<CommandGroup key={groupName} heading={groupName}>
						{groupCmds.map((command) => (
							<CommandItem
								key={command.id}
								value={[command.text, ...(command.keywords || [])].join(" ")}
								keywords={command.hint ? [command.hint] : undefined}
								onSelect={() => handleSelect(command)}
							>
								<span className="w-5">{command.icon}</span>
								<span className="flex-1">{command.text}</span>
								{command.shortcut ? (
									<kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
										{command.shortcut}
									</kbd>
								) : (
									command.hint && <CommandShortcut>{command.hint}</CommandShortcut>
								)}
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
};
