import type React from "react";
import { CommandPalette, GitErrorDialog } from "../../shared/ui";
import {
	type UseGlobalCommandPaletteProps,
	useGlobalCommandPalette,
} from "../hooks/useGlobalCommandPalette";

export type GlobalCommandPaletteProps = UseGlobalCommandPaletteProps;

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = (props) => {
	const {
		handleClose,
		handleCommandSelect,
		sortedCommands,
		recentDocumentItems,
		showRecentDocuments,
		handleSubPaletteBack,
		isErrorDialogOpen,
		closeErrorDialog,
		gitError,
	} = useGlobalCommandPalette(props);

	return (
		<>
			<CommandPalette
				isOpen={props.isOpen}
				onClose={handleClose}
				onCommandSelect={handleCommandSelect}
				commands={sortedCommands}
				placeholder="Type a command or search..."
				subPaletteItems={showRecentDocuments ? recentDocumentItems : undefined}
				subPaletteTitle={showRecentDocuments ? "Recent Documents" : undefined}
				onSubPaletteBack={handleSubPaletteBack}
			/>
			<GitErrorDialog isOpen={isErrorDialogOpen} onClose={closeErrorDialog} error={gitError} />
		</>
	);
};
