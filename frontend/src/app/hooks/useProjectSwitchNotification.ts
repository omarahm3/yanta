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
	const { success, info } = useNotification();
	const previousProjectRef = useRef<Project | undefined>(undefined);

	useEffect(() => {
		const unsubscribe = useProjectStore.subscribe(
			(state) => state.currentProject,
			(currentProject) => {
				const previousProject = previousProjectRef.current;
				previousProjectRef.current = currentProject;

				// Skip initial mount
				if (previousProject === undefined && currentProject === undefined) {
					return;
				}

				// Skip if project didn't actually change
				if (previousProject?.id === currentProject?.id) {
					return;
				}

				// Show notification
				if (currentProject) {
					success(`Switched to @${currentProject.alias}`);
				}
			},
		);

		return unsubscribe;
	}, [success, info]);
};
