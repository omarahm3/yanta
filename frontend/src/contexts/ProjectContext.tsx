import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Project, projectsFromModels } from "../types";
import { ListActive, ListArchived } from "../../wailsjs/go/project/Service";
import { EventsOn } from "../../wailsjs/runtime/runtime";

interface ProjectContextValue {
  currentProject: Project | undefined;
  setCurrentProject: (project: Project | undefined) => void;
  projects: Project[];
  archivedProjects: Project[];
  loadProjects: () => Promise<void>;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({
  children,
}) => {
  const [currentProject, setCurrentProject] = useState<Project | undefined>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

      setCurrentProject((prev) => {
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
    const unsubscribe = EventsOn(
      "yanta/project/changed",
      (data: { id: string; op: string }) => {
        console.log("Project changed event received:", data);
        loadProjects();
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadProjects]);

  const value: ProjectContextValue = {
    currentProject,
    setCurrentProject,
    projects,
    archivedProjects,
    loadProjects,
    isLoading,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};

export const useProjectContext = (): ProjectContextValue => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return context;
};
