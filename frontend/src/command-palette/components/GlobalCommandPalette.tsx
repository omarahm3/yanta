import type React from "react";
import { CommandPalette, GitErrorDialog } from "../../shared/ui";
import {
	type UseGlobalCommandPaletteProps,
	useGlobalCommandPalette,
} from "../hooks/useGlobalCommandPalette";

export type GlobalCommandPaletteProps = UseGlobalCommandPaletteProps;

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = (props) => {
	const {
		isOpen,
		handleClose,
		handleCommandSelect,
		sortedCommands,
		isErrorDialogOpen,
		closeErrorDialog,
		gitError,
	} = useGlobalCommandPalette(props);

	return (
		<>
			<CommandPalette
				isOpen={isOpen}
				onClose={handleClose}
				onCommandSelect={handleCommandSelect}
				commands={sortedCommands}
				placeholder="Type a command or search documents..."
			/>
			<GitErrorDialog isOpen={isErrorDialogOpen} onClose={closeErrorDialog} error={gitError} />
		</>
	);
};
