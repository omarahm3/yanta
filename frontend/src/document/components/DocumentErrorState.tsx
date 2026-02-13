import React from "react";
import { Layout } from "@/app";
import type { NavigationState, PageName } from "../../shared/types";
import { Button, type SidebarSection } from "../../shared/ui";

interface DocumentErrorStateProps {
	sidebarSections: SidebarSection[];
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const DocumentErrorState: React.FC<DocumentErrorStateProps> = React.memo(
	({ sidebarSections, onNavigate, onRegisterToggleSidebar }) => (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="document"
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div className="flex flex-col items-center justify-center h-full gap-4">
				<div className="text-xl text-red">❌ Document Not Found</div>
				<div className="text-text-dim">
					Document could not be loaded. It may have been deleted or doesn't exist.
				</div>
				<Button variant="primary" onClick={() => onNavigate?.("dashboard")} className="mt-4">
					← Back to Documents
				</Button>
			</div>
		</Layout>
	),
);

DocumentErrorState.displayName = "DocumentErrorState";
