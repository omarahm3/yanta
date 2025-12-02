import { useCallback, useMemo } from "react";
import type { SidebarSection } from "../components/ui";
import { useDocumentCount, useProjectContext } from "../contexts";
import type { Filter } from "../types";
import { useNotification } from "./useNotification";

interface UseSidebarSectionsProps {
	currentPage: string;
	onNavigate?: (page: string) => void;
	filters?: Filter[];
	onFilterSelect?: (filterId: string) => void;
	additionalSections?: SidebarSection[];
}

export const useSidebarSections = ({
	currentPage,
	onNavigate,
	filters,
	onFilterSelect,
	additionalSections = [],
}: UseSidebarSectionsProps): SidebarSection[] => {
	const { currentProject, projects, archivedProjects, setCurrentProject } = useProjectContext();
	const { getCount } = useDocumentCount();
	const { success } = useNotification();

	const handleProjectSelect = useCallback(
		(projectId: string) => {
			const allProjects = [...projects, ...archivedProjects];
			const project = allProjects.find((p) => p.id === projectId);
			if (project) {
				setCurrentProject(project);
				success(`Switched to ${project.name}`);
			}
		},
		[projects, archivedProjects, setCurrentProject, success],
	);

	return useMemo(() => {
		const sections: SidebarSection[] = [];

		sections.push({
			id: "navigation",
			title: "NAVIGATION",
			items: [
				{
					id: "dashboard",
					label: "dashboard",
					active: currentPage === "dashboard",
					onClick: () => onNavigate?.("dashboard"),
				},
				{
					id: "projects",
					label: "projects",
					active: currentPage === "projects",
					onClick: () => onNavigate?.("projects"),
				},
				{
					id: "search",
					label: "search",
					active: currentPage === "search",
					onClick: () => onNavigate?.("search"),
				},
				{
					id: "settings",
					label: "settings",
					active: currentPage === "settings",
					onClick: () => onNavigate?.("settings"),
				},
			],
		});

		if (projects.length > 0 && currentPage !== "settings" && currentPage !== "document") {
			sections.push({
				id: "projects",
				title: "PROJECTS",
				items: projects.map((project) => ({
					id: project.id,
					label: project.alias,
					count: getCount(project.id),
					active: project.id === currentProject?.id,
					onClick: () => handleProjectSelect(project.id),
				})),
			});
		}

		if (filters && filters.length > 0) {
			const timeFilters = filters.filter((f) => f.type === "time");
			const categoryFilters = filters.filter((f) => f.type === "category");

			sections.push({
				id: "filters",
				title: "FILTERS",
				items: [
					...timeFilters.map((filter) => ({
						id: filter.id,
						label: filter.displayName,
						count: filter.entryCount,
						onClick: () => onFilterSelect?.(filter.id),
					})),
					...categoryFilters.map((filter) => ({
						id: filter.id,
						label: filter.displayName,
						count: filter.entryCount,
						onClick: () => onFilterSelect?.(filter.id),
					})),
				],
			});
		}

		sections.push(...additionalSections);

		if (archivedProjects.length > 0 && currentPage !== "settings" && currentPage !== "document") {
			sections.push({
				id: "archive",
				title: "ARCHIVE",
				items: archivedProjects.map((project) => ({
					id: project.id,
					label: project.alias || project.name,
					count: getCount(project.id),
					active: project.id === currentProject?.id,
					onClick: () => handleProjectSelect(project.id),
				})),
			});
		}

		return sections;
	}, [
		currentPage,
		onNavigate,
		projects,
		currentProject?.id,
		filters,
		onFilterSelect,
		additionalSections,
		archivedProjects,
		getCount,
		handleProjectSelect,
	]);
};
