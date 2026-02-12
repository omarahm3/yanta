import { memo } from "react";
import { useHotkeys } from "../hotkeys";
import type { NavigationState, PageName } from "../shared/types";
import { DocumentContent, DocumentErrorState, DocumentLoadingState } from "./components";
import { useDocumentController } from "./hooks/useDocumentController";

export interface DocumentProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	documentPath?: string;
	initialTitle?: string;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Document = memo<DocumentProps>(function Document({
	onNavigate,
	documentPath,
	initialTitle,
	onRegisterToggleSidebar,
}) {
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
});
