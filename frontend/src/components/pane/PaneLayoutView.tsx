import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import { usePaneHotkeys, usePaneLayout } from "../../pane";
import { useLatestRef } from "../../shared/hooks/useLatestRef";
import type { NavigationState } from "../../types";
import { Layout } from "../Layout";
import { PaneContainer } from "./PaneContainer";
import { PaneNavigateProvider } from "./PaneNavigateContext";

export interface PaneLayoutViewProps {
	onNavigate?: (page: string, state?: NavigationState) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	documentPath?: string;
}

export const PaneLayoutView: React.FC<PaneLayoutViewProps> = ({
	onNavigate,
	onRegisterToggleSidebar,
	documentPath,
}) => {
	const { layout, activePaneId, openDocumentInPane } = usePaneLayout();

	usePaneHotkeys();

	const activePaneIdRef = useLatestRef(activePaneId);

	const handlePaneAwareNavigate = useCallback(
		(page: string, state?: NavigationState) => {
			if (page === "document" && state?.documentPath) {
				openDocumentInPane(activePaneIdRef.current, state.documentPath as string);
			}
			onNavigate?.(page, state);
		},
		[openDocumentInPane, onNavigate],
	);

	const sidebarSections = useSidebarSections({
		currentPage: "document",
		onNavigate: handlePaneAwareNavigate,
	});

	const lastOpenedPathRef = useRef<string | undefined>(documentPath);

	useEffect(() => {
		if (documentPath && documentPath !== lastOpenedPathRef.current) {
			openDocumentInPane(activePaneId, documentPath);
			lastOpenedPathRef.current = documentPath;
		}
	}, [documentPath, activePaneId, openDocumentInPane]);

	return (
		<PaneNavigateProvider value={onNavigate ?? (() => {})}>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="document"
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				<div className="flex flex-col w-full h-full">
					<PaneContainer node={layout.root} />
				</div>
			</Layout>
		</PaneNavigateProvider>
	);
};
