import {
	type PluginConfigSchema,
	registerPluginConfig,
	unregisterPluginConfig,
} from "@/config/public";
import { usePreferencesStore } from "@/shared/stores/preferences.store";
import type { InstallRecord } from "../../bindings/yanta/internal/plugins/models";
import {
	GetCommunityPluginsEnabled,
	GetSupportedPluginAPIMajor,
	ListInstalled,
	ReadPluginEntrypoint,
} from "../../bindings/yanta/internal/plugins/wailsservice";
import { useCommandRegistryStore } from "../command-palette/registry";
import {
	getAllEditorBlockSpecs,
	getAllEditorExtensions,
	getAllEditorSlashMenuItems,
	getAllEditorStyleSpecs,
	getAllEditorTipTapExtensions,
	removeAllEditorPluginContributions,
	setEditorBlockActions,
	setEditorBlockSpecs,
	setEditorExtensions,
	setEditorLifecycleHooks,
	setEditorSlashMenuItems,
	setEditorStyleSpecs,
	setEditorTipTapExtensions,
	setEditorTools,
} from "../editor/extensions/registry/editorExtensionRegistry";
import { useSidebarRegistryStore } from "../sidebar/registry/sidebarRegistry.store";
import type {
	PersistedPluginState,
	PluginAPI,
	PluginDefinition,
	PluginRuntimeRecord,
} from "./types";

const PLUGIN_STATE_ID = "__plugin_state";
const PLUGIN_STATE_ENABLED_KEY = "enabled";

const definitions = new Map<string, PluginDefinition>();
const cleanups = new Map<string, () => void>();
const runtime = new Map<string, PluginRuntimeRecord>();
let supportedPluginAPIMajor: number | null = null;
let supportedPluginAPIMajorPromise: Promise<number> | null = null;

function toSource(pluginId: string): string {
	return `plugin:${pluginId}`;
}

function readPersistedState(): PersistedPluginState {
	const overrides = usePreferencesStore.getState().overrides;
	const stateRaw = overrides?.plugins?.[PLUGIN_STATE_ID];
	const enabledRaw = stateRaw?.[PLUGIN_STATE_ENABLED_KEY];
	if (!enabledRaw || typeof enabledRaw !== "object") {
		return { enabled: {} };
	}
	const enabledEntries = Object.entries(enabledRaw as Record<string, unknown>).filter(
		([, val]) => typeof val === "boolean",
	);
	return { enabled: Object.fromEntries(enabledEntries) as Record<string, boolean> };
}

async function writePersistedState(state: PersistedPluginState): Promise<void> {
	const store = usePreferencesStore.getState();
	const current = store.overrides?.plugins?.[PLUGIN_STATE_ID];
	const merged = {
		...(current ?? {}),
		[PLUGIN_STATE_ENABLED_KEY]: state.enabled,
	};
	await store.saveOverrides({
		plugins: {
			[PLUGIN_STATE_ID]: merged,
		},
	});
}

function createPluginAPI(pluginId: string): PluginAPI {
	const source = toSource(pluginId);
	const registerConfigForPlugin = <T>(def: PluginConfigSchema<T>): void => {
		registerPluginConfig(pluginId, def);
	};

	return {
		registerCommands: (commands) => {
			useCommandRegistryStore.getState().setCommands(source, commands);
		},
		registerSidebarSections: (sections) => {
			useSidebarRegistryStore.getState().setSections(source, sections);
		},
		registerEditorExtensions: (extensions) => {
			setEditorExtensions(source, extensions);
		},
		registerEditorTipTapExtensions: (extensions) => {
			setEditorTipTapExtensions(source, extensions);
		},
		registerEditorBlockSpecs: (blockSpecs) => {
			setEditorBlockSpecs(source, blockSpecs);
		},
		registerEditorStyleSpecs: (styleSpecs) => {
			setEditorStyleSpecs(source, styleSpecs);
		},
		registerEditorSlashMenuItems: (items) => {
			setEditorSlashMenuItems(source, items);
		},
		registerEditorTools: (tools) => {
			setEditorTools(source, tools);
		},
		registerEditorBlockActions: (actions) => {
			setEditorBlockActions(source, actions);
		},
		registerEditorLifecycleHooks: (hooks) => {
			setEditorLifecycleHooks(source, hooks);
		},
		registerConfig: registerConfigForPlugin,
	};
}

function cleanupPluginContributions(pluginId: string): void {
	const source = toSource(pluginId);
	useCommandRegistryStore.getState().removeSource(source);
	useSidebarRegistryStore.getState().removeSource(source);
	removeAllEditorPluginContributions(source);
	unregisterPluginConfig(pluginId);
}

function getPluginIsolationMode(entry: string): PluginRuntimeRecord["isolationMode"] {
	if (entry.startsWith("builtin:")) {
		return "builtin_trusted";
	}
	return "external_local";
}

function isRuntimeEntryAllowed(def: PluginDefinition): boolean {
	return Boolean(def.manifest.entry);
}

function isAPIVersionCompatible(apiVersion: string, supportedMajor: number): boolean {
	const trimmed = apiVersion.trim();
	if (!trimmed) return false;
	const majorPart = trimmed.includes(".") ? trimmed.slice(0, trimmed.indexOf(".")) : trimmed;
	const parsed = Number.parseInt(majorPart, 10);
	return Number.isInteger(parsed) && parsed === supportedMajor;
}

async function resolveSupportedPluginAPIMajor(): Promise<number> {
	if (supportedPluginAPIMajor !== null) {
		return supportedPluginAPIMajor;
	}
	if (supportedPluginAPIMajorPromise) {
		return supportedPluginAPIMajorPromise;
	}
	supportedPluginAPIMajorPromise = GetSupportedPluginAPIMajor()
		.then((major) => {
			const parsed = Number(major);
			if (!Number.isInteger(parsed) || parsed <= 0) {
				throw new Error(`invalid supported plugin API major: ${String(major)}`);
			}
			supportedPluginAPIMajor = parsed;
			return parsed;
		})
		.finally(() => {
			supportedPluginAPIMajorPromise = null;
		});
	return supportedPluginAPIMajorPromise;
}

function setRuntime(pluginId: string, patch: Partial<PluginRuntimeRecord>): void {
	const def = definitions.get(pluginId);
	if (!def) return;
	const prev = runtime.get(pluginId) ?? {
		manifest: def.manifest,
		isolationMode: getPluginIsolationMode(def.manifest.entry),
		isActive: false,
	};
	runtime.set(pluginId, { ...prev, ...patch });
}

function isExternalPluginManifestEntry(entry: string): boolean {
	return !entry.startsWith("builtin:");
}

export function registerPlugin(definition: PluginDefinition): void {
	definitions.set(definition.manifest.id, definition);
	setRuntime(definition.manifest.id, {
		manifest: definition.manifest,
		isolationMode: getPluginIsolationMode(definition.manifest.entry),
		isActive: false,
		lastError: undefined,
	});
}

function toPluginDefinitionManifest(record: InstallRecord): PluginDefinition["manifest"] {
	return {
		id: record.manifest.ID,
		name: record.manifest.Name,
		version: record.manifest.Version,
		apiVersion: record.manifest.APIVersion,
		entry: record.manifest.Entry,
		capabilities: Array.isArray(record.manifest.Capabilities)
			? (record.manifest.Capabilities as PluginDefinition["manifest"]["capabilities"])
			: [],
		description: record.manifest.Description,
		author: record.manifest.Author,
		homepage: record.manifest.Homepage,
	};
}

function sanitizePluginIdForSourceURL(pluginId: string): string {
	return pluginId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function importPluginModule(code: string, pluginId: string): Promise<unknown> {
	const source = `${code}\n//# sourceURL=yanta-plugin-${sanitizePluginIdForSourceURL(pluginId)}.mjs`;
	const moduleURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
	return import(/* @vite-ignore */ moduleURL);
}

function resolvePluginSetupExport(moduleValue: unknown): PluginDefinition["setup"] | null {
	if (!moduleValue || typeof moduleValue !== "object") {
		return null;
	}
	const moduleLike = moduleValue as {
		default?: unknown;
		setup?: unknown;
	};
	if (typeof moduleLike.setup === "function") {
		return moduleLike.setup as PluginDefinition["setup"];
	}
	if (moduleLike.default && typeof moduleLike.default === "object") {
		const defaultExport = moduleLike.default as {
			setup?: unknown;
		};
		if (typeof defaultExport.setup === "function") {
			return defaultExport.setup as PluginDefinition["setup"];
		}
	}
	return null;
}

export async function registerInstalledPlugins(): Promise<void> {
	const installed = await ListInstalled();
	if (!Array.isArray(installed)) {
		return;
	}

	const sorted = [...installed].sort((a, b) => a.manifest.ID.localeCompare(b.manifest.ID));
	for (const record of sorted) {
		const manifest = toPluginDefinitionManifest(record as InstallRecord);
		if (!manifest.id || definitions.has(manifest.id)) {
			continue;
		}
		if (manifest.entry.startsWith("builtin:")) {
			continue;
		}
		if (record.status !== "ok") {
			continue;
		}

		try {
			const entrySource = await ReadPluginEntrypoint(manifest.id);
			const moduleValue = await importPluginModule(entrySource, manifest.id);
			const setup = resolvePluginSetupExport(moduleValue);
			if (!setup) {
				registerPlugin({
					manifest,
					setup: () => {
						throw new Error(
							`Plugin "${manifest.id}" entrypoint must export a setup function (named "setup" or default.setup).`,
						);
					},
				});
				continue;
			}
			registerPlugin({
				manifest,
				setup,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			registerPlugin({
				manifest,
				setup: () => {
					throw new Error(`Unable to load plugin entrypoint: ${message}`);
				},
			});
		}
	}
}

export function listPlugins(): PluginRuntimeRecord[] {
	return Array.from(runtime.values()).sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

export async function loadPlugin(pluginId: string): Promise<void> {
	const def = definitions.get(pluginId);
	if (!def) return;
	if (cleanups.has(pluginId)) return;
	if (!isRuntimeEntryAllowed(def)) {
		setRuntime(pluginId, {
			isActive: false,
			lastError: "Sandbox policy blocks plugin entrypoint.",
		});
		return;
	}
	let supportedMajor: number;
	try {
		supportedMajor = await resolveSupportedPluginAPIMajor();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		setRuntime(pluginId, {
			isActive: false,
			lastError: `Unable to resolve supported plugin API major: ${message}`,
		});
		return;
	}
	if (!isAPIVersionCompatible(def.manifest.apiVersion, supportedMajor)) {
		setRuntime(pluginId, {
			isActive: false,
			lastError: `Unsupported plugin API version "${def.manifest.apiVersion}" (expected major ${supportedMajor}).`,
		});
		return;
	}

	const api = createPluginAPI(pluginId);
	try {
		const maybeCleanup = await def.setup(api);
		const cleanup =
			typeof maybeCleanup === "function"
				? maybeCleanup
				: () => {
						cleanupPluginContributions(pluginId);
					};
		cleanups.set(pluginId, () => {
			try {
				cleanup();
			} finally {
				cleanupPluginContributions(pluginId);
			}
		});
		setRuntime(pluginId, { isActive: true, lastError: undefined });
	} catch (err) {
		cleanupPluginContributions(pluginId);
		const message = err instanceof Error ? err.message : String(err);
		setRuntime(pluginId, { isActive: false, lastError: message });
	}
}

export function unloadPlugin(pluginId: string): void {
	const cleanup = cleanups.get(pluginId);
	if (cleanup) {
		cleanup();
		cleanups.delete(pluginId);
	} else {
		cleanupPluginContributions(pluginId);
	}
	setRuntime(pluginId, { isActive: false });
}

export async function enablePlugin(pluginId: string): Promise<void> {
	const state = readPersistedState();
	state.enabled[pluginId] = true;
	await writePersistedState(state);
	await loadPlugin(pluginId);
}

export async function disablePlugin(pluginId: string): Promise<void> {
	const state = readPersistedState();
	state.enabled[pluginId] = false;
	await writePersistedState(state);
	unloadPlugin(pluginId);
}

export async function loadEnabledPlugins(): Promise<void> {
	const state = readPersistedState();
	let communityEnabled = false;
	try {
		communityEnabled = await GetCommunityPluginsEnabled();
	} catch {
		communityEnabled = false;
	}
	const allDefs = Array.from(definitions.values()).sort((a, b) =>
		a.manifest.id.localeCompare(b.manifest.id),
	);
	for (const def of allDefs) {
		if (!communityEnabled && isExternalPluginManifestEntry(def.manifest.entry)) {
			unloadPlugin(def.manifest.id);
			setRuntime(def.manifest.id, {
				isActive: false,
				lastError: "Community plugins are disabled by Restricted Mode.",
			});
			continue;
		}
		const enabled = state.enabled[def.manifest.id] ?? true;
		if (enabled) {
			await loadPlugin(def.manifest.id);
		} else {
			unloadPlugin(def.manifest.id);
		}
	}
}

export function getActiveExternalPluginIds(): string[] {
	return Array.from(runtime.values())
		.filter((record) => isExternalPluginManifestEntry(record.manifest.entry) && record.isActive)
		.map((record) => record.manifest.id)
		.sort((a, b) => a.localeCompare(b));
}

export function hasActiveExternalPlugins(): boolean {
	return getActiveExternalPluginIds().length > 0;
}

export async function disableExternalPluginsForEditorRecovery(reason: string): Promise<string[]> {
	const activeIds = getActiveExternalPluginIds();
	for (const pluginId of activeIds) {
		setRuntime(pluginId, {
			isActive: false,
			lastError: reason,
		});
		try {
			await disablePlugin(pluginId);
		} catch {
			unloadPlugin(pluginId);
			setRuntime(pluginId, {
				isActive: false,
				lastError: reason,
			});
		}
	}
	return activeIds;
}

export function getRegisteredEditorExtensionCount(): number {
	return getAllEditorExtensions().length;
}

export function getRegisteredEditorTipTapExtensionCount(): number {
	return getAllEditorTipTapExtensions().length;
}

export function getRegisteredEditorBlockSpecCount(): number {
	return Object.keys(getAllEditorBlockSpecs()).length;
}

export function getRegisteredEditorStyleSpecCount(): number {
	return Object.keys(getAllEditorStyleSpecs()).length;
}

export function getRegisteredEditorSlashMenuItemCount(): number {
	return getAllEditorSlashMenuItems().length;
}

export function __resetPluginRegistryForTests(): void {
	for (const id of Array.from(cleanups.keys())) {
		unloadPlugin(id);
	}
	definitions.clear();
	cleanups.clear();
	runtime.clear();
	supportedPluginAPIMajor = null;
	supportedPluginAPIMajorPromise = null;
}
