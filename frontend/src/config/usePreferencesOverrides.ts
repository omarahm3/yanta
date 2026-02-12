import { useCallback } from "react";
import type { MergedConfig } from "../shared/stores/preferences.store";
import { useMergedConfig, usePreferencesStore } from "../shared/stores/preferences.store";
import type { PreferencesOverrides } from "./preferences";

export type { MergedConfig } from "../shared/stores/preferences.store";

/** Hook for components that need to read and mutate preferences overrides. */
export function usePreferencesOverrides() {
	const overrides = usePreferencesStore((s) => s.overrides);
	const isLoading = usePreferencesStore((s) => s.isLoading);
	const saveOverrides = usePreferencesStore((s) => s.saveOverrides);
	const config = useMergedConfig();

	const setOverrides = useCallback(
		async (newOverrides: PreferencesOverrides) => {
			await saveOverrides(newOverrides);
		},
		[saveOverrides],
	);

	return {
		config,
		overrides,
		isLoading,
		setOverrides,
	};
}

/** Re-export for convenience. */
export { useMergedConfig } from "../shared/stores/preferences.store";
