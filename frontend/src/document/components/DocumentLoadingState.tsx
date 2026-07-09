import React from "react";
import { Layout } from "@/app";
import type { PageName } from "../../shared/types";
import type { SidebarSection } from "../../shared/ui";
import { Skeleton } from "../../shared/ui/Skeleton";

interface DocumentLoadingStateProps {
	sidebarSections: SidebarSection[];
	onNavigate?: (page: PageName) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const DocumentLoadingState: React.FC<DocumentLoadingStateProps> = React.memo(
	({ sidebarSections, onNavigate: _onNavigate, onRegisterToggleSidebar }) => (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="document"
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div
				className="flex flex-col gap-4 p-6"
				role="status"
				aria-label="Loading document"
				aria-busy="true"
			>
				<Skeleton className="h-8 w-1/3" />
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-4 w-3/5" />
				<Skeleton className="h-4 w-2/5" />
			</div>
		</Layout>
	),
);

DocumentLoadingState.displayName = "DocumentLoadingState";
