import { FileText, FolderGit2, NotebookPen, Search, Settings } from "lucide-react";
import { createElement, type MouseEvent, useCallback, useMemo } from "react";
import { useSidebarRegistryStore } from "../../sidebar/registry/sidebarRegistry.store";
import { useDocumentCount } from "../stores/documentCount.store";
import { useProjectContext } from "../stores/project.store";
import { useRecentDocumentsStore } from "../stores/recentDocuments.store";
import { useSidebarStateStore } from "../stores/sidebarState.store";
import type { Filter, NavigationState, PageName } from "../types";
import type { SidebarSection } from "../ui";

const MAX_RECENTS_IN_SIDEBAR = 5;
const NAV_ICON_CLASS = "h-[1.125rem] w-[1.125rem]";

interface UseSidebarSectionsProps {
	currentPage: string;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onOpenDocument?: (path: string) => void;
	filters?: Filter[];
	onFilterSelect?: (filterId: string) => void;
	additionalSections?: SidebarSection[];
}

export const useSidebarSections = ({
	currentPage,
	onNavigate,
	onOpenDocument,
	filters,
	onFilterSelect,
	additionalSections = [],
}: UseSidebarSectionsProps): SidebarSection[] => {
	const { currentProject, projects, archivedProjects, setCurrentProject } = useProjectContext();
	const { getCount } = useDocumentCount();
	const sidebarSources = useSidebarRegistryStore((s) => s.sources);
	const pluginSections = useMemo(
		() => useSidebarRegistryStore.getState().getAllSections(),
		[sidebarSources],
	);

	const recentDocuments = useRecentDocumentsStore((s) => s.documents);
	const pinnedDocuments = useSidebarStateStore((s) => s.pinnedDocuments);
	const unpinDocument = useSidebarStateStore((s) => s.unpinDocument);

	const handleProjectSelect = useCallback(
		(projectId: string) => {
			const allProjects = [...projects, ...archivedProjects];
			const project = allProjects.find((p) => p.id === projectId);
			if (project) {
				setCurrentProject(project);
			}
		},
		[projects, archivedProjects, setCurrentProject],
	);

	return useMemo(() => {
		const sections: SidebarSection[] = [];

		sections.push({
			id: "navigation",
			title: "NAVIGATION",
			items: [
				{
					id: "dashboard",
					label: "documents",
					icon: createElement(FileText, { className: NAV_ICON_CLASS }),
					active: currentPage === "dashboard",
					onClick: () => onNavigate?.("dashboard"),
					tooltip: {
						tooltipId: "sidebar-documents",
						description: "Documents",
						shortcut: "Ctrl+1",
					},
				},
				{
					id: "journal",
					label: "journal",
					icon: createElement(NotebookPen, { className: NAV_ICON_CLASS }),
					active: currentPage === "journal",
					onClick: () => onNavigate?.("journal"),
					tooltip: {
						tooltipId: "sidebar-journal",
						description: "Journal",
						shortcut: "Ctrl+J",
					},
				},
				{
					id: "search",
					label: "search",
					icon: createElement(Search, { className: NAV_ICON_CLASS }),
					active: currentPage === "search",
					onClick: () => onNavigate?.("search"),
					tooltip: {
						tooltipId: "sidebar-search",
						description: "Search",
						shortcut: "Ctrl+Shift+F",
					},
				},
				{
					id: "projects",
					label: "projects",
					icon: createElement(FolderGit2, { className: NAV_ICON_CLASS }),
					active: currentPage === "projects",
					onClick: () => onNavigate?.("projects"),
					tooltip: {
						tooltipId: "sidebar-projects",
						description: "Projects",
					},
				},
				{
					id: "settings",
					label: "settings",
					icon: createElement(Settings, { className: NAV_ICON_CLASS }),
					active: currentPage === "settings",
					onClick: () => onNavigate?.("settings"),
					tooltip: {
						tooltipId: "sidebar-settings",
						description: "Settings",
						shortcut: "Ctrl+,",
					},
				},
			],
		});

		if (pinnedDocuments.length > 0) {
			sections.push({
				id: "pinned",
				title: "PINNED",
				items: pinnedDocuments.map((doc) => ({
					id: `pinned-${doc.path}`,
					label: doc.title || doc.path.split("/").pop() || doc.path,
					onClick: () => onOpenDocument?.(doc.path),
					action: {
						label: "Unpin",
						icon: "×",
						onClick: (e: MouseEvent) => {
							e.stopPropagation();
							unpinDocument(doc.path);
						},
					},
				})),
			});
		}

		if (recentDocuments.length > 0 && currentPage !== "settings") {
			sections.push({
				id: "recents",
				title: "RECENT",
				items: recentDocuments.slice(0, MAX_RECENTS_IN_SIDEBAR).map((doc) => ({
					id: `recent-${doc.path}`,
					label: doc.title || doc.path.split("/").pop() || doc.path,
					onClick: () => onOpenDocument?.(doc.path),
				})),
			});
		}

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
		sections.push(...pluginSections);

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
		onOpenDocument,
		projects,
		currentProject?.id,
		filters,
		onFilterSelect,
		additionalSections,
		pluginSections,
		archivedProjects,
		getCount,
		handleProjectSelect,
		pinnedDocuments,
		recentDocuments,
		unpinDocument,
	]);
};
