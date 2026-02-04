import type React from "react";
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
 */
export const PaneContent: React.FC<PaneContentProps> = ({ paneId, documentPath }) => {
	if (documentPath) {
		return <PaneDocumentView paneId={paneId} documentPath={documentPath} />;
	}

	return (
		<div className="flex flex-col h-full w-full">
			<PaneHeader paneId={paneId} documentPath={null} />
			<EmptyPane />
		</div>
	);
};
