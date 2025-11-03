import type React from "react";
import type { Command } from "../types";
import { type CommandOption, CommandPalette as UICommandPalette } from "./ui";

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onCommandSelect: (command: Command) => void;
	commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	isOpen,
	onClose,
	onCommandSelect,
	commands,
}) => {
	const commandOptions: CommandOption[] = commands.map((command) => ({
		id: command.id,
		icon: command.icon,
		text: command.text,
		hint: command.hint,
		action: command.action,
	}));

	return (
		<UICommandPalette
			isOpen={isOpen}
			onClose={onClose}
			onCommandSelect={(option) => onCommandSelect(commands.find((c) => c.id === option.id)!)}
			commands={commandOptions}
		/>
	);
};
