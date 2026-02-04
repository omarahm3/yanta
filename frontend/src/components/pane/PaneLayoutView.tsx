import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import { usePaneLayout, useSidebarSections } from "../../hooks";
import { usePaneHotkeys } from "../../hooks/usePaneHotkeys";
import { Layout } from "../Layout";
import { PaneContainer } from "./PaneContainer";

export interface PaneLayoutViewProps {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	documentPath?: string;
}

/**
 * Wraps PaneContainer inside a Layout with sidebar sections.
 *
 * Navigation integration:
 * - The App-level handleNavigate calls openDocumentInPane directly for
 *   immediate pane state updates when navigating to a document.
 * - This component also has a fallback useEffect for cases where the
 *   documentPath prop changes (e.g., sidebar navigation while already
 *   on the document page).
 * - Pane layout persists in PaneLayoutContext when navigating away
 *   (to dashboard, settings, etc.) and is restored when navigating back.
 */
export const PaneLayoutView: React.FC<PaneLayoutViewProps> = ({
	onNavigate,
	onRegisterToggleSidebar,
	documentPath,
}) => {
	const { layout, activePaneId, openDocumentInPane } = usePaneLayout();

	// Register pane keyboard shortcuts (split, close, navigate)
	usePaneHotkeys();

	// Use ref for activePaneId to keep the sidebar onNavigate handler stable
	const activePaneIdRef = useRef(activePaneId);
	useEffect(() => {
		activePaneIdRef.current = activePaneId;
	}, [activePaneId]);

	// Pane-aware navigation handler for sidebar interactions.
	// When a sidebar item triggers document navigation, open in the active pane.
	// For non-document navigation (e.g., going to dashboard), delegate to parent.
	const handlePaneAwareNavigate = useCallback(
		(page: string, state?: Record<string, string | number | boolean | undefined>) => {
			if (page === "document" && state?.documentPath) {
				openDocumentInPane(activePaneIdRef.current, state.documentPath as string);
			}
			// Always propagate to parent so currentPage and navigationState update
			onNavigate?.(page, state);
		},
		[openDocumentInPane, onNavigate],
	);

	const sidebarSections = useSidebarSections({
		currentPage: "document",
		onNavigate: handlePaneAwareNavigate,
	});

	// Track the last documentPath we opened to avoid re-opening on re-renders
	const lastOpenedPathRef = useRef<string | undefined>(undefined);

	// Fallback: when documentPath prop changes (e.g., from Router), open in active pane.
	// The primary path is via App.tsx handleNavigate → openDocumentInPane, but this
	// catches cases where the prop updates without going through handleNavigate.
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
