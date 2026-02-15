import { useCallback } from "react";
import { usePreferencesStore } from "@/shared/stores/preferences.store";
import { validatePluginConfig } from "./pluginConfigValidation";

export interface UsePluginConfigResult<T> {
	config: T;
	setConfig: (partial: Partial<T>) => Promise<void>;
	isLoading: boolean;
}

/**
 * Hook to read and write plugin-scoped config with schema validation.
 * Merges stored overrides with registered defaults; validates on read.
 */
export function usePluginConfig<T>(pluginId: string): UsePluginConfigResult<T> {
	const overrides = usePreferencesStore((s) => s.overrides);
	const isLoading = usePreferencesStore((s) => s.isLoading);
	const saveOverrides = usePreferencesStore((s) => s.saveOverrides);

	const raw = overrides?.plugins?.[pluginId];
	const result = validatePluginConfig<T>(pluginId, raw);
	const config = result.success ? result.data : (result.data as T);

	const setConfig = useCallback(
		async (partial: Partial<T>) => {
			const current = overrides?.plugins?.[pluginId] ?? {};
			const updated = { ...current, ...partial } as Record<string, unknown>;
			await saveOverrides({
				plugins: {
					[pluginId]: updated,
				},
			});
		},
		[pluginId, overrides?.plugins, saveOverrides],
	);

	return { config, setConfig, isLoading };
}

