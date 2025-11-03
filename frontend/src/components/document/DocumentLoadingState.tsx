import React from "react";
import { LoadingSpinner } from "../ui";

interface DocumentLoadingStateProps {
	sidebarSections: unknown[];
}

export const DocumentLoadingState: React.FC<DocumentLoadingStateProps> = React.memo(() => (
	<LoadingSpinner message="Loading document..." />
));

DocumentLoadingState.displayName = "DocumentLoadingState";
