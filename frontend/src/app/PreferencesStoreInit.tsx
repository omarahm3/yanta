import { useEffect } from "react";
import { usePreferencesStore } from "../shared/stores/preferences.store";

/**
 * Loads preferences overrides from backend on mount.
 * Must be rendered inside the app so the store is initialized before config consumers.
 */
export function PreferencesStoreInit() {
	useEffect(() => {
		usePreferencesStore.getState().loadOverrides();
	}, []);

	return null;
}
