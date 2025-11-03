import type React from "react";
import { useDocumentCount, useProjectContext } from "../contexts";
import type { Filter, Project } from "../types";
import { type SidebarItem, type SidebarSection, Sidebar as UISidebar } from "./ui";

interface SidebarProps {
	projects: Project[];
	filters: Filter[];
	onProjectSelect: (projectId: string) => void;
	onFilterSelect: (filterId: string) => void;
	onNavigate?: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
	projects,
	filters,
	onProjectSelect,
	onFilterSelect,
	onNavigate,
}) => {
	const { archivedProjects } = useProjectContext();
	const { getCount } = useDocumentCount();
	const timeFilters = filters.filter((f) => f.type === "time");
	const categoryFilters = filters.filter((f) => f.type === "category");

	const sections: SidebarSection[] = [
		{
			id: "navigation",
			title: "NAVIGATION",
			items: [
				{ id: "dashboard", label: "dashboard", active: true },
				{
					id: "projects",
					label: "projects",
					onClick: () => onNavigate?.("projects"),
				},
				{
					id: "search",
					label: "search",
					onClick: () => onNavigate?.("search"),
				},
				{
					id: "settings",
					label: "settings",
					onClick: () => onNavigate?.("settings"),
				},
			],
		},
		{
			id: "projects",
			title: "PROJECTS",
			items: projects.map(
				(project): SidebarItem => ({
					id: project.id,
					label: project.name,
					count: getCount(project.id),
					active: false,
					onClick: () => onProjectSelect(project.id),
				}),
			),
		},
		{
			id: "filters",
			title: "FILTERS",
			items: [
				...timeFilters.map(
					(filter): SidebarItem => ({
						id: filter.id,
						label: filter.displayName,
						count: filter.entryCount,
						onClick: () => onFilterSelect(filter.id),
					}),
				),
				...categoryFilters.map(
					(filter): SidebarItem => ({
						id: filter.id,
						label: filter.displayName,
						count: filter.entryCount,
						onClick: () => onFilterSelect(filter.id),
					}),
				),
			],
		},
		{
			id: "archive",
			title: "ARCHIVE",
			items: archivedProjects.map(
				(project): SidebarItem => ({
					id: project.id,
					label: project.alias || project.name,
					count: getCount(project.id),
					onClick: () => onProjectSelect(project.id),
				}),
			),
		},
	];

	return <UISidebar sections={sections} />;
};
