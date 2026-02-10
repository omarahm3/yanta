import type React from "react";
import { useHotkeys } from "../hooks";
import type { NavigationState, PageName } from "../types";
import { DocumentContent, DocumentErrorState, DocumentLoadingState } from "./components";
import { useDocumentController } from "./hooks/useDocumentController";

export interface DocumentProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	documentPath?: string;
	initialTitle?: string;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Document: React.FC<DocumentProps> = ({
	onNavigate,
	documentPath,
	initialTitle,
	onRegisterToggleSidebar,
}) => {
	const controller = useDocumentController({
		onNavigate,
		documentPath,
		initialTitle,
		onRegisterToggleSidebar,
	});

	useHotkeys(controller.hotkeys);

	if (controller.isLoading) {
		return <DocumentLoadingState sidebarSections={controller.sidebarSections} />;
	}

	if (controller.showError) {
		return (
			<DocumentErrorState
				sidebarSections={controller.sidebarSections}
				onNavigate={onNavigate}
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			/>
		);
	}

	return <DocumentContent {...controller.contentProps} />;
};
