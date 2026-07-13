import type React from "react";
import { CommandPalette } from "../../shared/ui";
import {
	type UseGlobalCommandPaletteProps,
	useGlobalCommandPalette,
} from "../hooks/useGlobalCommandPalette";

export type GlobalCommandPaletteProps = UseGlobalCommandPaletteProps;

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = (props) => {
	const { isOpen, handleClose, handleCommandSelect, sortedCommands, recentCommands } =
		useGlobalCommandPalette(props);

	return (
		<CommandPalette
			isOpen={isOpen}
			onClose={handleClose}
			onCommandSelect={handleCommandSelect}
			commands={sortedCommands}
			recentCommands={recentCommands}
			placeholder="Type a command or search documents..."
		/>
	);
};
