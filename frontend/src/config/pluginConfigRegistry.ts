import type { z } from "zod";

/**
 * Plugin config schema definition: Zod schema + defaults.
 * Used when registering a plugin's config namespace.
 */
export interface PluginConfigSchema<T = unknown> {
	schema: z.ZodType<T>;
	defaults: T;
}

const registry = new Map<string, PluginConfigSchema<unknown>>();

/**
 * Register a plugin's config schema and defaults.
 * Call this when a plugin loads (or for built-in "plugins" at app init).
 */
export function registerPluginConfig<T>(pluginId: string, def: PluginConfigSchema<T>): void {
	registry.set(pluginId, def as PluginConfigSchema<unknown>);
}

/**
 * Get a plugin's config definition for validation.
 */
export function getPluginConfigDefinition(
	pluginId: string,
): PluginConfigSchema<unknown> | undefined {
	return registry.get(pluginId);
}

/**
 * Get all registered plugin IDs.
 */
export function getRegisteredPluginIds(): string[] {
	return Array.from(registry.keys());
}
