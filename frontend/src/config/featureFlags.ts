export interface FeatureFlags {
	tooltipHints: boolean;
	appMonitor: boolean;
	commandLine: boolean;
	plugins: boolean;
}

export type FeatureFlagName = keyof FeatureFlags;

function readEnvBool(value: unknown): boolean {
	if (value === true || value === false) return value;
	if (typeof value !== "string") return false;
	const normalized = value.trim().toLowerCase();
	return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

export function getEnvDefaultFeatureFlags(): FeatureFlags {
	const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
	return {
		tooltipHints: readEnvBool(env?.YANTA_ENABLE_TOOLTIP_HINTS),
		appMonitor: readEnvBool(env?.YANTA_ENABLE_APP_MONITOR),
		commandLine: readEnvBool(env?.YANTA_ENABLE_COMMAND_LINE),
		plugins: readEnvBool(env?.YANTA_ENABLE_PLUGINS),
	};
}

export function featureFlagsFromModel(model: unknown): FeatureFlags {
	const defaults = getEnvDefaultFeatureFlags();
	const source = (model ?? {}) as {
		TooltipHints?: boolean;
		AppMonitor?: boolean;
		CommandLine?: boolean;
		Plugins?: boolean;
	};
	return {
		tooltipHints: source.TooltipHints ?? defaults.tooltipHints,
		appMonitor: source.AppMonitor ?? defaults.appMonitor,
		commandLine: source.CommandLine ?? defaults.commandLine,
		plugins: source.Plugins ?? defaults.plugins,
	};
}

// Backward-compatible exports for legacy consumers/tests. Runtime flag store is source of truth.
export const ENABLE_TOOLTIP_HINTS = getEnvDefaultFeatureFlags().tooltipHints;
export const ENABLE_APP_MONITOR = getEnvDefaultFeatureFlags().appMonitor;
export const ENABLE_COMMAND_LINE = getEnvDefaultFeatureFlags().commandLine;
export const ENABLE_PLUGINS = getEnvDefaultFeatureFlags().plugins;
