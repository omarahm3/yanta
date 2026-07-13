import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { ListActive, ListArchived } from "../../../bindings/yanta/internal/project/service";
import type { Project } from "../types";
import { projectsFromModels } from "../types";
import { BackendLogger } from "../utils/backendLogger";

const LAST_PROJECT_KEY = "yanta:lastProjectAlias";

function readLastProjectAlias(): string | null {
	try {
		if (typeof window === "undefined") return null;
		return window.localStorage.getItem(LAST_PROJECT_KEY);
	} catch {
		return null;
	}
}

function writeLastProjectAlias(alias: string | undefined): void {
	try {
		if (typeof window === "undefined") return;
		if (alias) {
			window.localStorage.setItem(LAST_PROJECT_KEY, alias);
		} else {
			window.localStorage.removeItem(LAST_PROJECT_KEY);
		}
	} catch {
		// Best-effort persistence; ignore failures
	}
}

export interface ProjectContextValue {
	currentProject: Project | undefined;
	setCurrentProject: (project: Project | undefined) => void;
	previousProject: Project | undefined;
	switchToLastProject: () => void;
	projects: Project[];
	archivedProjects: Project[];
	loadProjects: () => Promise<void>;
	isLoading: boolean;
}

interface ProjectState extends ProjectContextValue {
	/** Set by loadProjects on error; cleared after toast so init can show notification. */
	loadError: string | null;
	clearLoadError: () => void;
}

export const useProjectStore = create<ProjectState>()(
	subscribeWithSelector((set, _get) => ({
		currentProject: undefined,
		previousProject: undefined,
		projects: [],
		archivedProjects: [],
		isLoading: false,
		loadError: null,

		setCurrentProject: (project) =>
			set((s) => {
				if (s.currentProject && s.currentProject.id !== project?.id) {
					if (project) writeLastProjectAlias(project.alias);
					return { currentProject: project, previousProject: s.currentProject };
				}
				if (project) writeLastProjectAlias(project.alias);
				return { currentProject: project };
			}),

		switchToLastProject: () =>
			set((s) => {
				if (!s.previousProject) return s;
				return {
					currentProject: s.previousProject,
					previousProject: s.currentProject,
				};
			}),

		loadProjects: async () => {
			set({ isLoading: true, loadError: null });
			try {
				const [activeModels, archivedModels] = await Promise.all([ListActive(), ListArchived()]);
				const activeProjects = projectsFromModels(activeModels);
				const archived = projectsFromModels(archivedModels);

				set((s) => {
					const prev = s.currentProject;
					const lastAlias = readLastProjectAlias();
					let nextCurrent: Project | undefined = prev;
					if (!prev && activeProjects.length > 0) {
						const restored = lastAlias ? activeProjects.find((p) => p.alias === lastAlias) : undefined;
						nextCurrent = restored ?? activeProjects[0];
					} else if (prev && activeProjects.find((p) => p.id === prev.id)) {
						nextCurrent = prev;
					} else if (
						prev &&
						!activeProjects.find((p) => p.id === prev.id) &&
						activeProjects.length > 0
					) {
						const restored = lastAlias ? activeProjects.find((p) => p.alias === lastAlias) : undefined;
						nextCurrent = restored ?? activeProjects[0];
					}
					if (nextCurrent) {
						writeLastProjectAlias(nextCurrent.alias);
					}
					return {
						projects: activeProjects,
						archivedProjects: archived,
						currentProject: nextCurrent,
						isLoading: false,
						loadError: null,
					};
				});
			} catch (err) {
				BackendLogger.error("Failed to load projects:", err);
				set({
					isLoading: false,
					loadError: err instanceof Error ? err.message : "Failed to load projects",
				});
			}
		},

		clearLoadError: () => set({ loadError: null }),
	})),
);

/** Same API as legacy useProjectContext — use in components. */
export function useProjectContext(): ProjectContextValue {
	const currentProject = useProjectStore((s) => s.currentProject);
	const previousProject = useProjectStore((s) => s.previousProject);
	const projects = useProjectStore((s) => s.projects);
	const archivedProjects = useProjectStore((s) => s.archivedProjects);
	const isLoading = useProjectStore((s) => s.isLoading);
	const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
	const switchToLastProject = useProjectStore((s) => s.switchToLastProject);
	const loadProjects = useProjectStore((s) => s.loadProjects);
	return {
		currentProject,
		previousProject,
		projects,
		archivedProjects,
		isLoading,
		setCurrentProject,
		switchToLastProject,
		loadProjects,
	};
}
