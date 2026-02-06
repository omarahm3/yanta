import { Events } from "@wailsio/runtime";
import type React from "react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { ListActive, ListArchived } from "../../bindings/yanta/internal/project/service";
import { type Project, projectsFromModels } from "../types";

interface ProjectContextValue {
	currentProject: Project | undefined;
	setCurrentProject: (project: Project | undefined) => void;
	previousProject: Project | undefined;
	switchToLastProject: () => void;
	projects: Project[];
	archivedProjects: Project[];
	loadProjects: () => Promise<void>;
	isLoading: boolean;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
	children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
	const [currentProject, setCurrentProjectInternal] = useState<Project | undefined>();
	const [previousProject, setPreviousProject] = useState<Project | undefined>();
	const [projects, setProjects] = useState<Project[]>([]);
	const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const setCurrentProject = useCallback((project: Project | undefined) => {
		setCurrentProjectInternal((prev) => {
			if (prev && prev.id !== project?.id) {
				setPreviousProject(prev);
			}
			return project;
		});
	}, []);

	const switchToLastProject = useCallback(() => {
		if (previousProject) {
			setCurrentProjectInternal((current) => {
				setPreviousProject(current);
				return previousProject;
			});
		}
	}, [previousProject]);

	const loadProjects = useCallback(async () => {
		try {
			setIsLoading(true);
			const [activeProjectsModels, archivedProjectsModels] = await Promise.all([
				ListActive(),
				ListArchived(),
			]);
			const activeProjects = projectsFromModels(activeProjectsModels);
			const archived = projectsFromModels(archivedProjectsModels);
			setProjects(activeProjects);
			setArchivedProjects(archived);

			setCurrentProjectInternal((prev) => {
				if (!prev && activeProjects.length > 0) {
					return activeProjects[0];
				}
				if (prev && activeProjects.find((p) => p.id === prev.id)) {
					return prev;
				}
				if (prev && !activeProjects.find((p) => p.id === prev.id)) {
					return activeProjects[0];
				}
				return prev;
			});
		} catch (err) {
			console.error("Failed to load projects:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	useEffect(() => {
		const unsubscribe = Events.On("yanta/project/changed", () => {
			loadProjects();
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [loadProjects]);

	const value = useMemo<ProjectContextValue>(
		() => ({
			currentProject,
			setCurrentProject,
			previousProject,
			switchToLastProject,
			projects,
			archivedProjects,
			loadProjects,
			isLoading,
		}),
		[
			currentProject,
			setCurrentProject,
			previousProject,
			switchToLastProject,
			projects,
			archivedProjects,
			loadProjects,
			isLoading,
		],
	);

	return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProjectContext = (): ProjectContextValue => {
	const context = useContext(ProjectContext);
	if (!context) {
		throw new Error("useProjectContext must be used within a ProjectProvider");
	}
	return context;
};
