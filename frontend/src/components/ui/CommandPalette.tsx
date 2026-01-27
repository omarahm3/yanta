import type React from "react";
import { useCallback } from "react";

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
	action: () => void;
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

	return (
		<CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
			<CommandInput placeholder={placeholder} />
			<CommandList>
				<CommandEmpty>No commands found.</CommandEmpty>
				<CommandGroup>
					{commands.map((command) => (
						<CommandItem
							key={command.id}
							value={command.text}
							keywords={command.hint ? [command.hint] : undefined}
							onSelect={() => handleSelect(command)}
						>
							<span className="w-5">{command.icon}</span>
							<span className="flex-1">{command.text}</span>
							{command.hint && <CommandShortcut>{command.hint}</CommandShortcut>}
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
};
