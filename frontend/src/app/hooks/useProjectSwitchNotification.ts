import { useEffect, useRef } from "react";
import { useNotification } from "../../shared/hooks";
import { useProjectStore } from "../../shared/stores/project.store";
import type { Project } from "../../shared/types";

/**
 * Subscribes to project changes and shows a toast notification.
 * Centralizes the "Switched to @project" announcement so all entry points
 * (sidebar, ProjectSwitcher, Ctrl+Tab) get consistent feedback.
 */
export const useProjectSwitchNotification = (): void => {
	const { success } = useNotification();
	// Seed with the project already selected at mount so a remount (or the first
	// load setting currentProject) doesn't fire a spurious "Switched to" toast.
	const previousProjectRef = useRef<Project | undefined>(useProjectStore.getState().currentProject);

	useEffect(() => {
		const unsubscribe = useProjectStore.subscribe(
			(state) => state.currentProject,
			(currentProject) => {
				const previousProject = previousProjectRef.current;
				previousProjectRef.current = currentProject;

				// Skip if project didn't actually change
				if (previousProject?.id === currentProject?.id) {
					return;
				}

				// Show notification (fall back to name when alias is missing)
				if (currentProject) {
					const identifier = currentProject.alias ? `@${currentProject.alias}` : currentProject.name;
					success(`Switched to ${identifier}`);
				}
			},
		);

		return unsubscribe;
	}, [success]);
};
