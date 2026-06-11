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
		recentDocumentItems,
		allDocumentItems,
		showRecentDocuments,
		showAllDocuments,
		allDocumentsLoading,
		handleSubPaletteBack,
		isErrorDialogOpen,
		closeErrorDialog,
		gitError,
	} = useGlobalCommandPalette(props);

		const effectiveSubPaletteItems = showAllDocuments
		? allDocumentsLoading
			? undefined
			: allDocumentItems
		: showRecentDocuments
			? recentDocumentItems
			: undefined;

	const effectiveSubPaletteTitle = showAllDocuments
		? "Quick Switch: Jump to Document"
		: showRecentDocuments
			? "Recent Documents"
			: undefined;

	const effectivePlaceholder = showAllDocuments
		? allDocumentsLoading
			? "Loading documents..."
			: "Search all documents..."
		: "Type a command or search...";

	return (
		<>
			<CommandPalette
				isOpen={isOpen}
				onClose={handleClose}
				onCommandSelect={handleCommandSelect}
				commands={sortedCommands}
				placeholder={effectivePlaceholder}
				subPaletteItems={effectiveSubPaletteItems}
				subPaletteTitle={effectiveSubPaletteTitle}
				onSubPaletteBack={handleSubPaletteBack}
			/>
			<GitErrorDialog isOpen={isErrorDialogOpen} onClose={closeErrorDialog} error={gitError} />
		</>
	);
};
