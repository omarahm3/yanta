import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { Layout } from "@/app";
import { useSidebarSections } from "../../shared/hooks";
import { useLatestRef } from "../../shared/hooks/useLatestRef";
import type { NavigationState, PageName } from "../../shared/types";
import { usePaneHotkeys, usePaneLayout } from "..";
import { PaneContainer } from "./PaneContainer";
import { PaneNavigateProvider } from "./PaneNavigateContext";

export interface PaneLayoutViewProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
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
		(page: PageName, state?: NavigationState) => {
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
