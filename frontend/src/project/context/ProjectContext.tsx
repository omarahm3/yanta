import type React from "react";
import type { ReactNode } from "react";

export type { ProjectContextValue } from "../../shared/stores/project.store";

/**
 * Project state is now in shared/stores/project.store (Zustand).
 * Re-export so existing imports keep working.
 */
export { useProjectContext } from "../../shared/stores/project.store";

/**
 * No-op for backward compatibility: tests may still wrap with ProjectProvider.
 */
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;

/** For tests that import ProjectContext.Provider — same as ProjectProvider (no-op). */
export const ProjectContext = {
	Provider: ProjectProvider,
} as const;
