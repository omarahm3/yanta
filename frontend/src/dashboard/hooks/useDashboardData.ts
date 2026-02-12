import { useCallback, useEffect, useRef } from "react";
import { useDocumentContext } from "../../document";
import { useProjectContext } from "../../project";
import type { Document } from "../../shared/types/Document";
import type { Project } from "../../shared/types/Project";

export interface UseDashboardDataOptions {
	showArchived: boolean;
}

export interface UseDashboardDataResult {
	projectsLoading: boolean;
	documentsLoading: boolean;
	documents: Document[];
	currentProject: Project | null | undefined;
	reloadDocuments: () => Promise<void>;
}

export function useDashboardData({
	showArchived,
}: UseDashboardDataOptions): UseDashboardDataResult {
	const { currentProject, isLoading: projectsLoading } = useProjectContext();
	const { documents, loadDocuments, isLoading: documentsLoading } = useDocumentContext();

	const currentProjectRef = useRef(currentProject);
	const showArchivedRef = useRef(showArchived);
	useEffect(() => {
		currentProjectRef.current = currentProject;
		showArchivedRef.current = showArchived;
	}, [currentProject, showArchived]);

	useEffect(() => {
		if (currentProject) {
			loadDocuments(currentProject.alias, showArchived);
		}
	}, [currentProject, loadDocuments, showArchived]);

	const reloadDocuments = useCallback(async () => {
		const project = currentProjectRef.current;
		if (!project) return;
		await loadDocuments(project.alias, showArchivedRef.current);
	}, [loadDocuments]);

	return {
		projectsLoading,
		documentsLoading,
		documents,
		currentProject,
		reloadDocuments,
	};
}
