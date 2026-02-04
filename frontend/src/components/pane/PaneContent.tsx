import type React from "react";
import { useCallback } from "react";
import { usePaneLayout } from "../../hooks/usePaneLayout";
import { EmptyPane } from "./EmptyPane";
import { PaneDocumentView } from "./PaneDocumentView";
import { PaneHeader } from "./PaneHeader";

export interface PaneContentProps {
	paneId: string;
	documentPath: string | null;
}

/**
 * Wrapper component that chooses between PaneDocumentView (when a document
 * is loaded) and EmptyPane (when no document is selected in the pane).
 *
 * Provides a pane-scoped navigation handler: document navigations open
 * in this specific pane, while non-document navigations are ignored
 * (handled at the App level).
 */
export const PaneContent: React.FC<PaneContentProps> = ({ paneId, documentPath }) => {
	const { openDocumentInPane } = usePaneLayout();

	// Pane-scoped navigation: intercept document navigation and open in this pane.
	// Non-document navigation (e.g., Escape → dashboard) is intentionally a no-op
	// in pane mode — panes don't navigate away from the document page.
	const handlePaneNavigate = useCallback(
		(page: string, state?: Record<string, string | number | boolean | undefined>) => {
			if (page === "document" && state?.documentPath) {
				openDocumentInPane(paneId, state.documentPath as string);
			}
		},
		[paneId, openDocumentInPane],
	);

	if (documentPath) {
		return (
			<PaneDocumentView paneId={paneId} documentPath={documentPath} onNavigate={handlePaneNavigate} />
		);
	}

	return (
		<div className="flex flex-col h-full w-full">
			<PaneHeader paneId={paneId} documentPath={null} />
			<EmptyPane />
		</div>
	);
};
