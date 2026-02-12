import { getPluginConfigDefinition } from "./pluginConfigRegistry";

export type ValidatePluginConfigResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; data: unknown };

/**
 * Validate plugin config against registered schema.
 * On failure, returns defaults and logs warning.
 */
export function validatePluginConfig<T>(
	pluginId: string,
	raw: unknown,
): ValidatePluginConfigResult<T> {
	const def = getPluginConfigDefinition(pluginId);
	if (!def) {
		return {
			success: true,
			data: raw as T,
		};
	}

	const result = def.schema.safeParse(raw);
	if (result.success) {
		return { success: true, data: result.data as T };
	}

	const error = result.error.errors.map((e) => e.message).join("; ");
	if (typeof console !== "undefined" && console.warn) {
		console.warn(`[pluginConfig] Invalid config for plugin "${pluginId}":`, error, "Using defaults.");
	}
	return {
		success: false,
		error,
		data: def.defaults as T,
	};
}
