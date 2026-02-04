import type React from "react";
import { useEffect, useRef } from "react";
import { usePaneLayout, useSidebarSections } from "../../hooks";
import { Layout } from "../Layout";
import { PaneContainer } from "./PaneContainer";

export interface PaneLayoutViewProps {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	documentPath?: string;
}

/**
 * Wraps PaneContainer inside a Layout with sidebar sections.
 * Handles opening a document in the active pane on first navigation
 * to the document page with a documentPath.
 */
export const PaneLayoutView: React.FC<PaneLayoutViewProps> = ({
	onNavigate,
	onRegisterToggleSidebar,
	documentPath,
}) => {
	const sidebarSections = useSidebarSections({
		currentPage: "document",
		onNavigate,
	});

	const { layout, activePaneId, openDocumentInPane } = usePaneLayout();

	// Track the last documentPath we opened to avoid re-opening on re-renders
	const lastOpenedPathRef = useRef<string | undefined>(undefined);

	// On first navigation to 'document' page with a documentPath, open it in the active pane
	useEffect(() => {
		if (documentPath && documentPath !== lastOpenedPathRef.current) {
			openDocumentInPane(activePaneId, documentPath);
			lastOpenedPathRef.current = documentPath;
		}
	}, [documentPath, activePaneId, openDocumentInPane]);

	return (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="document"
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div className="flex flex-col w-full h-full">
				<PaneContainer node={layout.root} />
			</div>
		</Layout>
	);
};
