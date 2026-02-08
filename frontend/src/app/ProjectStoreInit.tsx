import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useNotification } from "../hooks/useNotification";
import { useProjectStore } from "../shared/stores/project.store";

/**
 * Loads projects on mount, subscribes to yanta/project/changed, and shows toast on load error.
 * Replaces the init and event subscription that lived in ProjectProvider.
 */
export function ProjectStoreInit() {
	const { error: notifyError } = useNotification();

	useEffect(() => {
		useProjectStore.getState().loadProjects();
	}, []);

	useEffect(() => {
		const unsubscribe = useProjectStore.subscribe(
			(state) => state.loadError,
			(loadError) => {
				if (loadError) {
					notifyError(loadError);
					useProjectStore.getState().clearLoadError();
				}
			},
		);
		return unsubscribe;
	}, [notifyError]);

	useEffect(() => {
		const unsubscribe = Events.On("yanta/project/changed", () => {
			useProjectStore.getState().loadProjects();
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, []);

	return null;
}
