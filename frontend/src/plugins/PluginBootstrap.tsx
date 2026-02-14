import { useEffect, useRef } from "react";
import { usePreferencesStore } from "../shared/stores/preferences.store";
import { registerBuiltInPlugins } from "./bootstrap";
import { loadEnabledPlugins, registerInstalledPlugins } from "./registry";

export function PluginBootstrap() {
	const isLoadingPreferences = usePreferencesStore((s) => s.isLoading);
	const hasStartedRef = useRef(false);

	useEffect(() => {
		registerBuiltInPlugins();
	}, []);

	useEffect(() => {
		if (isLoadingPreferences || hasStartedRef.current) return;
		hasStartedRef.current = true;
		void (async () => {
			await registerInstalledPlugins();
			await loadEnabledPlugins();
		})();
	}, [isLoadingPreferences]);

	return null;
}
