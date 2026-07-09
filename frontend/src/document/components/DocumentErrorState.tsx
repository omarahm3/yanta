import React from "react";
import { Layout } from "@/app";
import type { NavigationState, PageName } from "../../shared/types";
import { Button, type SidebarSection } from "../../shared/ui";

interface DocumentErrorStateProps {
	sidebarSections: SidebarSection[];
	error: string;
	onRetry: () => void;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const isCorrupted = (message: string) => /corrupted/i.test(message);

export const DocumentErrorState: React.FC<DocumentErrorStateProps> = React.memo(
	({ sidebarSections, error, onRetry, onNavigate, onRegisterToggleSidebar }) => {
		const corrupted = isCorrupted(error);
		const heading = corrupted ? "Document Corrupted" : "Document Not Found";
		const description = corrupted
			? "The document file could not be parsed. It may contain conflict markers or be damaged."
			: "Document could not be loaded. It may have been deleted or doesn't exist.";

		return (
			<Layout
				sidebarSections={sidebarSections}
				currentPage="document"
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				<div
					className="flex flex-col items-center justify-center h-full gap-4"
					role="alert"
					aria-live="assertive"
				>
					<div className="text-xl text-red">
						{corrupted ? "⚠" : "❌"} {heading}
					</div>
					<div className="text-text-dim text-center max-w-md">{description}</div>
					<div className="text-text-dim text-xs font-mono text-center max-w-lg break-words">{error}</div>
					<div className="flex gap-3 mt-4">
						<Button variant="primary" onClick={onRetry}>
							Retry
						</Button>
						<Button variant="secondary" onClick={() => onNavigate?.("dashboard")}>
							← Back to Documents
						</Button>
					</div>
				</div>
			</Layout>
		);
	},
);

DocumentErrorState.displayName = "DocumentErrorState";
