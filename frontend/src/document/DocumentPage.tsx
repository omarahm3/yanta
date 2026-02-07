import type React from "react";
import { DocumentContent, DocumentErrorState, DocumentLoadingState } from "./components";
import { useHotkeys } from "../hooks";
import type { NavigationState } from "../types";
import { useDocumentController } from "./hooks/useDocumentController";

export interface DocumentProps {
	onNavigate?: (page: string, state?: NavigationState) => void;
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
